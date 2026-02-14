import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from '~server/app.config';
import { CoreModule } from '~server/core/core.module';
import { GitHubModule } from '~server/github/github.module';
import { HealthModule } from '~server/health/health.module';
import { ReactRouterModule } from '~server/react-router/react-router.module';
import { TelemetryModule } from '~server/telemetry/telemetry.module';

/**
 * Root Nest module for the server runtime.
 *
 * Registers global caching/configuration and wires the HTTP client,
 * API controller, and providers used to build route load context.
 */
@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
    }),
    CoreModule,
    GitHubModule,
    HealthModule,
    ReactRouterModule,
    TelemetryModule,
  ],
})
export class AppModule {}
