export interface PullRequest {
  id: string;
  url: string;
  title: string;
  status: 'open' | 'closed' | 'merged';
}

export interface IGitProvider {
  createPullRequest(branch: string, title: string, description: string): Promise<PullRequest>;
  syncIssues(): Promise<any[]>;
  checkStatus(prId: string): Promise<string>;
}
