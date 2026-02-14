import { Expose, Transform } from 'class-transformer';
import { IsIn, IsInt, IsUrl, Min } from 'class-validator';

import { toNumber } from '~server/app.config';

/**
 * Class-validator schema for GitHub feature environment variables.
 */
export class GitHubConfig {
  /**
   * Upstream GitHub status summary endpoint consumed by server-side services.
   */
  @Expose({ name: 'GITHUB_STATUS_URL' })
  @IsUrl({ require_tld: true, require_protocol: true }, { message: 'GITHUB_STATUS_URL must be a valid absolute URL' })
  readonly githubStatusUrl: string = 'https://www.githubstatus.com/api/v2/summary.json';

  /**
   * Cache TTL in milliseconds for GitHub status responses.
   */
  @Transform(toNumber())
  @Expose({ name: 'GITHUB_STATUS_CACHE_TTL_MS' })
  @IsInt({ message: 'GITHUB_STATUS_CACHE_TTL_MS must be an integer' })
  @Min(0, { message: 'GITHUB_STATUS_CACHE_TTL_MS must be >= 0' })
  readonly githubStatusCacheTtlMs: number = 60_000;

  /**
   * Selects which GitHub status provider to use at runtime.
   * Allowed values: `mock` | `default`.
   */
  @Expose({ name: 'GITHUB_STATUS_PROVIDER_TYPE' })
  @IsIn(['mock', 'default'], { message: 'GITHUB_STATUS_PROVIDER_TYPE must be one of: mock, default' })
  readonly githubStatusProviderType: 'mock' | 'default' = 'mock';

  /**
   * Timeout in milliseconds for GitHub status requests.
   */
  @Transform(toNumber())
  @Expose({ name: 'GITHUB_STATUS_TIMEOUT_MS' })
  @IsInt({ message: 'GITHUB_STATUS_TIMEOUT_MS must be an integer' })
  @Min(0, { message: 'GITHUB_STATUS_TIMEOUT_MS must be >= 0' })
  readonly githubStatusTimeoutMs: number = 2000;
}
