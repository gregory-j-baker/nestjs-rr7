import { registerAs, type ConfigType } from '@nestjs/config';
import { plainToInstance, type TransformFnParams } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

import { CoreConfig } from '~server/core/core.config';
import { GitHubConfig } from '~server/github/github.config';
import { TelemetryConfig } from '~server/telemetry/telemetry.config';

/**
 * Per-module namespaced loaders. Exporting these makes it easy for modules to
 * request only their slice (e.g. `configService.getOrThrow<GitHubConfig>('githubConfig')`).
 */
export const coreConfig = registerAs('coreConfig', () => validateConfigSlice(CoreConfig, process.env));
export const githubConfig = registerAs('githubConfig', () => validateConfigSlice(GitHubConfig, process.env));
export const telemetryConfig = registerAs('telemetryConfig', () => validateConfigSlice(TelemetryConfig, process.env));

/**
 * Typed access to the `appConfig` namespace returned by Nest ConfigService.
 */
export type AppConfig = Readonly<ConfigType<typeof appConfig>>;

/**
 * Application configuration namespace used by Nest's ConfigService.
 *
 * This factory merges validated configuration slices from multiple config
 * classes (CoreConfig, GitHubConfig, TelemetryConfig) into a single
 * namespaced object registered under `appConfig`.
 */
export const appConfig = registerAs('appConfig', () => {
  return {
    ...validateConfigSlice(CoreConfig, process.env),
    ...validateConfigSlice(GitHubConfig, process.env),
    ...validateConfigSlice(TelemetryConfig, process.env),
  };
});

/**
 * Helper for tests and other tooling to produce a validated `AppConfig`
 * instance from an arbitrary `env` record (does not register with
 * `ConfigModule`).
 */
export function loadConfigFrom(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    ...validateConfigSlice(CoreConfig, env),
    ...validateConfigSlice(GitHubConfig, env),
    ...validateConfigSlice(TelemetryConfig, env),
  };
}

/**
 * Transformation factory for class-transformer that coerces incoming
 * environment variable values to boolean.
 */
export function toBoolean(): (params: TransformFnParams) => boolean {
  return ({ value }: TransformFnParams) => {
    return String(value).toLowerCase() === 'true';
  };
}

/**
 * Transformation factory that coerces incoming environment variable values to
 * numbers.
 */
export function toNumber(): (params: TransformFnParams) => number {
  return ({ value }: TransformFnParams) => {
    return Number(value);
  };
}

/**
 * Generic constructor type for classes with a no-argument constructor.
 */
type Constructor<T> = new () => T;

/**
 * Format class-validator ValidationError objects into a single-line
 * human-readable string suitable for error messages.
 */
function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((error) => {
      const constraints = error.constraints ? Object.values(error.constraints).join(', ') : 'invalid value';
      return `${error.property}: ${constraints}`;
    })
    .join('; ');
}

/**
 * Validate and transform a flat source (typically `process.env`) into an
 * instance of the provided schema class using class-transformer and
 * class-validator.
 */
export function validateConfigSlice<TSchema extends object>(
  schema: Constructor<TSchema>,
  source: Record<string, unknown>,
): TSchema {
  const instance = plainToInstance(schema, source, {
    enableImplicitConversion: true,
    excludeExtraneousValues: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(instance, {
    skipMissingProperties: false,
    whitelist: true,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const formattedErrors = formatValidationErrors(errors);
    throw new Error(`Invalid environment variables: ${formattedErrors}`);
  }

  return instance;
}
