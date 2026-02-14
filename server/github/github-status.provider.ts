/**
 * DI token for the active GitHub status provider.
 */
export const GitHubStatusProvider = Symbol.for('GITHUB_STATUS_PROVIDER');

/**
 * Normalized response shape returned from the GitHub status endpoint.
 */
export type GitHubStatusSummary = Readonly<Record<string, unknown>>;

/**
 * Minimal interface a GitHub status provider must implement.
 */
export interface GitHubStatusProvider {
  /**
   * Fetches a summary of the GitHub status.
   * @returns A promise that resolves to a normalized GitHub status summary.
   */
  getSummary(): Promise<GitHubStatusSummary>;
}
