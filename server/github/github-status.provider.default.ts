import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { firstValueFrom, timeout } from 'rxjs';

import type { AppConfig } from '~server/app.config';
import type { GitHubStatusProvider, GitHubStatusSummary } from '~server/github/github-status.provider';

/**
 * Provider responsible for fetching and caching GitHub status information.
 */
@Injectable()
export class DefaultGitHubStatusProvider implements GitHubStatusProvider {
  private static readonly logger = new Logger(DefaultGitHubStatusProvider.name);

  private readonly appConfig: AppConfig;
  private readonly cacheManager: Cache;
  private readonly http: HttpService;

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(HttpService) httpService: HttpService,
  ) {
    this.appConfig = configService.getOrThrow<AppConfig>('appConfig');
    this.cacheManager = cacheManager;
    this.http = httpService;
  }

  /**
   * Returns GitHub status summary data using cache-first lookup.
   *
   * @returns The status summary object from cache or the remote API response
   *          data.
   * @remarks On cache miss, performs an HTTP GET to
   *          `appConfig.githubStatusUrl`, stores the response in cache under the key
   *          `github-status:summary` with a TTL computed from
   *          `appConfig.githubStatusCacheTtlMs` (rounded up to seconds).
   * @throws Errors from the HTTP client or cache manager are propagated to the
   *         caller.
   */
  async getSummary(): Promise<GitHubStatusSummary> {
    const cachedSummary = await this.cacheManager.get<GitHubStatusSummary>('github-status:summary');

    if (cachedSummary) {
      return cachedSummary;
    }

    const response = await firstValueFrom(
      this.http
        .get<GitHubStatusSummary>(this.appConfig.githubStatusUrl)
        .pipe(timeout(this.appConfig.githubStatusTimeoutMs)),
    );

    const cacheTtlSeconds = Math.ceil(this.appConfig.githubStatusCacheTtlMs / 1000);
    await this.cacheManager.set('github-status:summary', response.data, cacheTtlSeconds);

    return response.data;
  }
}
