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
}

export interface RepoInfo {
  owner: string;
  repo: string;
}
