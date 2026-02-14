import { Module } from '@nestjs/common';

import type { AppConfig } from '~server/app.config';
import type { GitHubStatusProvider } from '~server/github/github-status.provider';
import { GitHubModule } from '~server/github/github.module';
import { LoadContextProvider } from '~server/react-router/load-context.provider';
import type { TelemetryProvider } from '~server/telemetry/telemetry.provider';

declare module 'react-router' {
  interface AppLoadContext {
    readonly appConfig: () => AppConfig;
    readonly githubStatusProvider: () => GitHubStatusProvider;
    readonly telemetryProvider: () => TelemetryProvider;
  }
}

@Module({
  imports: [
    GitHubModule, //
  ],
  providers: [
    LoadContextProvider, //
  ],
  exports: [
    LoadContextProvider, //
  ],
})
export class ReactRouterModule {}
