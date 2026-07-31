import axios, { AxiosInstance } from 'axios';
import { IGitProvider, PullRequest } from './GitProvider';
import { logger } from '../../utils/logger';

/**
 * GitHub integration using the REST API v3.
 * Requires a personal access token (or GitHub App token) with `repo` scope.
 */
export class GitHubProvider implements IGitProvider {
  private client: AxiosInstance;
  private owner: string;
  private repo: string;
  private baseBranch: string;

  constructor(accessToken: string, owner: string, repo: string, baseBranch = 'main') {
    this.owner = owner;
    this.repo = repo;
    this.baseBranch = baseBranch;
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 15000,
    });
  }

  async createPullRequest(branch: string, title: string, description: string): Promise<PullRequest> {
    logger.info(`[GitHubProvider] Creating PR for ${this.owner}/${this.repo} (${branch} → ${this.baseBranch})`);
    try {
      const { data } = await this.client.post(`/repos/${this.owner}/${this.repo}/pulls`, {
        title,
        head: branch,
        base: this.baseBranch,
        body: description,
      });

      return {
        id: String(data.number),
        url: data.html_url,
        title: data.title,
        status: data.state === 'closed' ? (data.merged ? 'merged' : 'closed') : 'open',
      };
    } catch (error: any) {
      const detail = error.response?.data?.message ?? error.message;
      logger.error(`[GitHubProvider] createPullRequest failed: ${detail}`);
      throw new Error(`GitHub PR creation failed: ${detail}`);
    }
  }

  async syncIssues(): Promise<any[]> {
    logger.info(`[GitHubProvider] Syncing issues for ${this.owner}/${this.repo}`);
    try {
      const { data } = await this.client.get(`/repos/${this.owner}/${this.repo}/issues`, {
        params: { state: 'open', per_page: 100 },
      });

      // GitHub returns PRs in the issues endpoint; filter them out.
      return (data as any[])
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          id: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          labels: (issue.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l.name)),
          url: issue.html_url,
          createdAt: issue.created_at,
        }));
    } catch (error: any) {
      const detail = error.response?.data?.message ?? error.message;
      logger.error(`[GitHubProvider] syncIssues failed: ${detail}`);
      throw new Error(`GitHub issue sync failed: ${detail}`);
    }
  }

  async checkStatus(prId: string): Promise<string> {
    logger.info(`[GitHubProvider] Checking status for PR #${prId} in ${this.owner}/${this.repo}`);
    try {
      const { data } = await this.client.get(`/repos/${this.owner}/${this.repo}/pulls/${prId}`);
      if (data.merged) return 'merged';
      if (data.state === 'closed') return 'closed';
      // Check mergeable state for open PRs
      return data.mergeable_state ?? 'open';
    } catch (error: any) {
      const detail = error.response?.data?.message ?? error.message;
      logger.error(`[GitHubProvider] checkStatus failed: ${detail}`);
      throw new Error(`GitHub status check failed: ${detail}`);
    }
  }
}
