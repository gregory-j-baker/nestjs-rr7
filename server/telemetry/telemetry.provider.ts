import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  metrics,
  SpanStatusCode,
  trace,
  type Attributes,
  type MetricOptions,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import type { AppConfig } from '~server/app.config';
import { validateConfigSlice } from '~server/app.config';
import { TelemetryConfig } from '~server/telemetry/telemetry.config';

/**
 * Provider that initializes and exposes OpenTelemetry helpers for the app.
 *
 * - Boots a `NodeSDK` when telemetry is enabled in configuration.
 * - Exposes convenience helpers: `count`, `withSpan`, `getTracer`, `getMeter`.
 */
@Injectable()
export class TelemetryProvider implements OnModuleInit, OnModuleDestroy {
  private static readonly logger = new Logger(TelemetryProvider.name);

  private readonly appConfig: AppConfig;

  /**
   * Creates a `TelemetryProvider`.
   * @param configService - Nest config service injected to read `appConfig`.
   */
  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.appConfig = configService.getOrThrow<AppConfig>('appConfig');
  }

  /**
   * Initialize a NodeSDK from environment variables early in process startup.
   *
   * @param env - Optional environment record (defaults to `process.env`).
   * @returns The created `NodeSDK` instance, or `undefined` when telemetry is
   *          disabled.
   * @remarks Creates a `NodeSDK` and writes it to `global.__otel_sdk` (side
   *          effect). The SDK is created but not started by this method; the
   *          provider lifecycle will start/stop the SDK.
   */
  public static initFromEnv(env: NodeJS.ProcessEnv = process.env): NodeSDK | undefined {
    // Build a validated TelemetryConfig from provided env and delegate to
    // the config-based initializer. This ensures validation and defaults are
    // consistent with the rest of the app.
    const cfg = validateConfigSlice(TelemetryConfig, env);
    return TelemetryProvider.initFromConfig(cfg);
  }

  /**
   * Initialize a NodeSDK from a validated `TelemetryConfig` instance.
   * This keeps SDK construction deterministic and testable.
   */
  public static initFromConfig(cfg: TelemetryConfig): NodeSDK | undefined {
    if (!cfg.telemetryEnabled) {
      TelemetryProvider.logger.log('Telemetry disabled by configuration; not initializing SDK');
      return;
    }

    const endpoint = cfg.otelExporterOtlpEndpoint;
    const serviceName = cfg.otelServiceName;
    const serviceVersion = cfg.otelServiceVersion;
    const exportIntervalMillis = cfg.otelExportIntervalMs;

    if (global.__otel_sdk) {
      return global.__otel_sdk;
    }

    global.__otel_sdk = new NodeSDK({
      instrumentations: [getNodeAutoInstrumentations()],
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: exportIntervalMillis,
      }),
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
      }),
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    });

    TelemetryProvider.logger.log(
      `Telemetry initialized; exporting to ${endpoint} (service=${serviceName}@${serviceVersion})`,
    );

    return global.__otel_sdk;
  }

  public async onModuleInit(): Promise<void> {
    if (!this.appConfig.telemetryEnabled) {
      return TelemetryProvider.logger.log('Telemetry disabled by configuration; not starting SDK');
    }

    global.__otel_sdk?.start();

    TelemetryProvider.logger.log(
      `Telemetry SDK started (service=${this.appConfig.otelServiceName}@${this.appConfig.otelServiceVersion})`,
    );
  }

  /**
   * Lifecycle hook invoked by Nest on module destroy. Shuts down the NodeSDK if
   * present.
   */
  public async onModuleDestroy(): Promise<void> {
    if (global.__otel_sdk) {
      await global.__otel_sdk.shutdown();
      TelemetryProvider.logger.log('Telemetry SDK shut down');
    }
  }

  /**
   * Create and increment a named counter.
   */
  public count(name: string, metricOptions?: MetricOptions, value = 1, attributes?: Attributes) {
    this.getMeter()
      .createCounter(name, metricOptions)
      .add(value, attributes ?? {});
  }

  /**
   * (overload signature for `withSpan()` - see the implementation below) Run a
   * synchronous function inside a created span. Returns the function's result
   * of type T.
   */
  public withSpan<T>(name: string, fn: (span: Span) => T, options?: SpanOptions): T;

  /**
   * (overload signature for `withSpan()` - see the implementation below) Run an
   * asynchronous function (returns a Promise) inside a created span. Returns a
   * Promise resolving to type T.
   */
  public withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options?: SpanOptions): Promise<T>;

  /**
   * Run a function inside a created span.
   *
   * This method is overloaded so TypeScript will narrow the return type:
   * - If `fn` returns a `Promise<T>`, the call returns `Promise<T>`.
   * - If `fn` returns `T`, the call returns `T`.
   *
   * The span is ended automatically after the function completes or throws. If
   * `fn` throws or the returned promise rejects, the error is recorded on the
   * span before the span is ended and the error re-thrown.
   *
   * @template T - Result type returned by `fn`.
   * @param name - Span name.
   * @param fn - Callback executed with the created span.
   * @param options - Optional span creation options.
   * @returns The value returned by `fn`, or a Promise resolving to that value.
   */
  public withSpan<T>(name: string, fn: (span: Span) => T | Promise<T>, options?: SpanOptions): T | Promise<T> {
    const tracer = trace.getTracer(this.appConfig.otelServiceName, this.appConfig.otelServiceVersion);

    const span = tracer.startSpan(name, options);

    try {
      const result = fn(span);

      if (result instanceof Promise) {
        return result
          .then((res) => {
            span.end();
            return res;
          })
          .catch((error) => {
            this.recordSpanException(error, span);
            span.end();
            throw error;
          });
      }

      span.end();
      return result;
    } catch (error) {
      this.recordSpanException(error, span);
      span.end();
      throw error;
    }
  }

  /**
   * Returns an OpenTelemetry `Tracer` instance.
   * @param name - Optional tracer name; defaults to the configured service
   *               name.
   */
  public getTracer(name?: string) {
    return trace.getTracer(name ?? this.appConfig.otelServiceName, this.appConfig.otelServiceVersion);
  }

  /**
   * Returns an OpenTelemetry `Meter` instance.
   * @param name - Optional meter name; defaults to the configured service name.
   */
  public getMeter(name?: string) {
    return metrics.getMeter(name ?? this.appConfig.otelServiceName);
  }

  /**
   * Records an exception in the given span. If the error is a coded error, it
   * will include the code in the exception.
   *
   * @returns The original error.
   */
  private recordSpanException(error: unknown, span?: Span) {
    if (!this.isFetchResponse(error)) {
      span?.recordException({
        name: this.getName(error),
        message: this.getMessage(error),
        stack: this.getStack(error),
      });

      span?.setStatus({
        code: SpanStatusCode.ERROR,
        message: this.getMessage(error),
      });
    }

    return error;
  }

  /**
   * Type guard for `Error`.
   */
  private isError(error: unknown): error is Error {
    return error instanceof Error;
  }

  /**
   * Type guard for `Response` (web Fetch API response objects).
   *
   * Note: React Router v7 uses thrown `Response` objects as part of its control
   * flow (for example to short-circuit loaders/actions). Those thrown responses
   * are not runtime errors and should not be recorded as exceptions on spans —
   * this guard lets us detect and ignore them.
   */
  private isFetchResponse(error: unknown): error is Response {
    return error instanceof Response;
  }

  /**
   * Safe accessor for an error message if the value is an `Error`.
   */
  private getMessage(error: unknown): string | undefined {
    if (this.isError(error)) {
      return error.message;
    }
  }

  /**
   * Extracts a name for the error to record in spans. Falls back to
   * `String(error)` for non-Error values.
   */
  private getName(error: unknown): string {
    if (this.isError(error)) {
      return error.name;
    }

    return String(error);
  }

  /**
   * Returns the stack trace for an `Error`, if available.
   */
  private getStack(error: unknown): string | undefined {
    if (this.isError(error)) {
      return error.stack;
    }
  }
}
