import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';

import { GitHubStatusIndicator } from '~server/github/github-status.health';

/**
 * Aggregate health controller for application-wide checks.
 */
@Controller()
export class HealthController {
  constructor(
    @Inject(HealthCheckService)
    private readonly healthCheckService: HealthCheckService,
    @Inject(GitHubStatusIndicator)
    private readonly githubStatusIndicator: GitHubStatusIndicator,
  ) {}

  /**
   * Runs all registered health indicators.
   */
  @HealthCheck()
  @Get('/api/healthz')
  public check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.githubStatusIndicator.isHealthy('github'), //
    ]);
  }
}
