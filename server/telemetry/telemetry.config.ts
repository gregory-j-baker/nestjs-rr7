import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsString, IsUrl, Min } from 'class-validator';

import { toBoolean, toNumber } from '~server/app.config';

/**
 * Class-validator schema for telemetry-related environment variables.
 */
export class TelemetryConfig {
  @Transform(toBoolean())
  @Expose({ name: 'TELEMETRY_ENABLED' })
  @IsBoolean({ message: 'TELEMETRY_ENABLED must be a boolean' })
  readonly telemetryEnabled: boolean = false;

  @Expose({ name: 'OTEL_EXPORTER_OTLP_ENDPOINT' })
  @IsUrl(
    { require_tld: false, require_protocol: true },
    { message: 'OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL including protocol' },
  )
  readonly otelExporterOtlpEndpoint: string = 'http://localhost:4318';

  @Expose({ name: 'OTEL_SERVICE_NAME' })
  @IsString({ message: 'OTEL_SERVICE_NAME must be a string' })
  @IsNotEmpty({ message: 'OTEL_SERVICE_NAME must not be empty' })
  readonly otelServiceName: string = 'nestjs-rr7';

  @Expose({ name: 'OTEL_SERVICE_VERSION' })
  @IsString({ message: 'OTEL_SERVICE_VERSION must be a string' })
  @IsNotEmpty({ message: 'OTEL_SERVICE_VERSION must not be empty' })
  readonly otelServiceVersion: string = '0.0.0';

  @Transform(toNumber())
  @Expose({ name: 'OTEL_EXPORT_INTERVAL_MS' })
  @IsInt({ message: 'OTEL_EXPORT_INTERVAL_MS must be an integer (milliseconds)' })
  @Min(1, { message: 'OTEL_EXPORT_INTERVAL_MS must be positive' })
  readonly otelExportIntervalMs: number = 60_000;
}
