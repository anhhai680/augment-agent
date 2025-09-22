/**
 * Action input types for the Augment Agent with template support
 */

export interface InputField {
  envVar: string;
  required: boolean;
  transform?: (value: string) => any;
}

export interface ActionInputs {
  // Base inputs
  augmentSessionAuth?: string | undefined;
  augmentApiToken?: string | undefined;
  augmentApiUrl?: string | undefined;
  githubToken?: string | undefined;
  instruction?: string | undefined;
  instructionFile?: string | undefined;
  model?: string | undefined;

  // Template inputs
  templateDirectory?: string | undefined;
  templateName?: string | undefined;
  customContext?: string | undefined;
  pullNumber?: number | undefined;
  repoName?: string | undefined;

  // Platform selection
  platform?: 'github' | 'azure-devops' | undefined;

  // Azure DevOps specific inputs
  azureDevOpsToken?: string | undefined;
  azureDevOpsOrganization?: string | undefined;
  azureDevOpsProject?: string | undefined;
  azureDevOpsRepository?: string | undefined;
  azureDevOpsPullRequestId?: number | undefined;
  azureDevOpsWorkItemId?: number | undefined;
  azureDevOpsBuildId?: number | undefined;

  // LLM Provider configuration
  llmProvider?: 'auggie' | 'openai' | 'claude' | 'google' | undefined;
  llmApiKey?: string | undefined;
  llmBaseUrl?: string | undefined;
  llmTemperature?: number | undefined;
  llmMaxTokens?: number | undefined;
  llmTimeout?: number | undefined;

  // Comment posting configuration
  postComment?: boolean | undefined;
  commentType?: 'comment' | 'review' | undefined;
  reviewEvent?: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' | undefined;
  useInlineComments?: boolean | undefined;
  inlineCommentStrategy?: 'review_with_comments' | 'individual_comments' | undefined;
}

export interface RepoInfo {
  owner: string;
  repo: string;
}
