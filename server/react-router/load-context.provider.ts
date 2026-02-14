import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppLoadContext } from 'react-router';

import type { AppConfig } from '~server/app.config';
import { GitHubStatusProvider } from '~server/github/github-status.provider';
import { TelemetryProvider } from '~server/telemetry/telemetry.provider';

/**
 * Builds the `AppLoadContext` object passed to every React Router loader via
 * `getLoadContext`.
 *
 * Keeping this inside the Nest DI graph means new services are wired here
 * rather than in the bootstrap/server entry point.
 */
@Injectable()
export class LoadContextProvider {
  private static readonly logger = new Logger(LoadContextProvider.name);

  private readonly appConfig: AppConfig;
  private readonly githubStatusProvider: GitHubStatusProvider;
  private readonly telemetryProvider: TelemetryProvider;

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(GitHubStatusProvider) githubStatusProvider: GitHubStatusProvider,
    @Inject(TelemetryProvider) telemetryProvider: TelemetryProvider,
  ) {
    this.appConfig = configService.getOrThrow<AppConfig>('appConfig');
    this.githubStatusProvider = githubStatusProvider;
    this.telemetryProvider = telemetryProvider;
  }

  /**
   * Creates the object supplied as React Router load context.
   *
   * @returns An `AppLoadContext` where each property is a zero-arg function
   *          returning the corresponding service/value (lazy accessor).
   */
  create(): AppLoadContext {
    return {
      appConfig: () => this.appConfig,
      githubStatusProvider: () => this.githubStatusProvider,
      telemetryProvider: () => this.telemetryProvider,
    };
  }
}
