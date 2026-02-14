import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { GitHubModule } from '~server/github/github.module';
import { HealthController } from '~server/health/health.controller';
import { PingController } from '~server/health/ping.controller';

@Module({
  imports: [
    GitHubModule, //
    TerminusModule,
  ],
  controllers: [
    HealthController, //
    PingController,
  ],
})
export class HealthModule {}
