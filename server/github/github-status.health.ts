import { Inject, Injectable, Logger } from '@nestjs/common';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { HealthIndicatorService } from '@nestjs/terminus';
import { GitHubStatusProvider } from '~server/github/github-status.provider';

/**
 * Health indicator that checks the current GitHub status using the
 * GitHubStatusProvider.
 *
 * This indicator integrates with @nestjs/terminus and returns a
 * HealthIndicatorResult indicating whether GitHub is healthy.
 */
@Injectable()
export class GitHubStatusIndicator {
  private static readonly logger = new Logger(GitHubStatusIndicator.name);

  /**
   * Create a new GitHubStatusIndicator.
   *
   * @param githubStatusProvider - provider used to fetch GitHub status summary
   * @param healthIndicatorService - service used to create health indicator
   * results
   */
  constructor(
    @Inject(GitHubStatusProvider)
    private readonly githubStatusProvider: GitHubStatusProvider,
    @Inject(HealthIndicatorService)
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Perform the health check.
   *
   * @param key - name of the health check key to include in the result
   * @returns a HealthIndicatorResult describing the health status
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.githubStatusProvider.getSummary();
      return indicator.up();
    } catch (err) {
      GitHubStatusIndicator.logger.error('GitHub health check failed', err instanceof Error ? err.stack : String(err));

      return indicator.down({
        message: 'GitHub status check failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
