import { HttpModule } from '@nestjs/axios';
import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import type { AppConfig } from '~server/app.config';
import { GitHubStatusIndicator } from '~server/github/github-status.health';
import { GitHubStatusProvider } from '~server/github/github-status.provider';
import { DefaultGitHubStatusProvider } from '~server/github/github-status.provider.default';
import { MockGitHubStatusProvider } from '~server/github/github-status.provider.mock';

/**
 * Module that provides GitHub-related health checks and a selectable
 * GitHub status provider implementation.
 *
 * The exported provider token (GITHUB_STATUS_PROVIDER) will resolve to either
 * DefaultGitHubStatusProvider or MockGitHubStatusProvider depending on
 * the runtime configuration (appConfig.githubStatusProviderType).
 */
@Module({
  imports: [
    HttpModule, //
    TerminusModule,
  ],
  providers: [
    GitHubStatusIndicator,
    DefaultGitHubStatusProvider,
    MockGitHubStatusProvider,
    GitHubModule.GitHubStatusProviderFactory,
  ],
  exports: [
    GitHubStatusIndicator, //
    GitHubStatusProvider,
  ],
})
export class GitHubModule {
  /**
   * Provider that selects the concrete GitHub status provider based on
   * application configuration.
   *
   * - provide: the DI token exported by this module
   * - useFactory: returns either the default or mock provider
   * - inject: dependencies required by the factory
   */
  public static GitHubStatusProviderFactory: Provider = {
    provide: GitHubStatusProvider,
    useFactory: (
      configService: ConfigService,
      defaultProvider: DefaultGitHubStatusProvider,
      mockProvider: MockGitHubStatusProvider,
    ) => {
      const appConfig = configService.getOrThrow<AppConfig>('appConfig');
      switch (appConfig.githubStatusProviderType) {
        case 'default': {
          return defaultProvider;
        }
        case 'mock': {
          return mockProvider;
        }
        default: {
          throw new Error(`Unknown githubStatusProviderType: ${appConfig.githubStatusProviderType}`);
        }
      }
    },
    inject: [
      ConfigService, //
      DefaultGitHubStatusProvider,
      MockGitHubStatusProvider,
    ],
  };
}
