/**
 * Configuration constants for the Augment Agent
 */

import type { InputField } from '../types/inputs.js';

export const ACTION_CONFIG = {
  NAME: 'Augment Agent',
};

export const INPUT_FIELD_MAP: Record<string, InputField> = {
  augmentSessionAuth: { envVar: 'INPUT_AUGMENT_SESSION_AUTH', required: false },
  augmentApiToken: { envVar: 'INPUT_AUGMENT_API_TOKEN', required: false },
  augmentApiUrl: { envVar: 'INPUT_AUGMENT_API_URL', required: false },
  customContext: { envVar: 'INPUT_CUSTOM_CONTEXT', required: false },
  githubToken: { envVar: 'INPUT_GITHUB_TOKEN', required: false },
  instruction: { envVar: 'INPUT_INSTRUCTION', required: false },
  instructionFile: { envVar: 'INPUT_INSTRUCTION_FILE', required: false },
  pullNumber: {
    envVar: 'INPUT_PULL_NUMBER',
    required: false,
    transform: (val: string) => parseInt(val, 10),
  },
  repoName: { envVar: 'INPUT_REPO_NAME', required: false },
  templateDirectory: { envVar: 'INPUT_TEMPLATE_DIRECTORY', required: false },
  templateName: { envVar: 'INPUT_TEMPLATE_NAME', required: false },
  model: { envVar: 'INPUT_MODEL', required: false },
  // Azure DevOps specific inputs
  azureDevOpsToken: { envVar: 'INPUT_AZURE_DEVOPS_TOKEN', required: false },
  azureDevOpsOrganization: { envVar: 'INPUT_AZURE_DEVOPS_ORGANIZATION', required: false },
  azureDevOpsProject: { envVar: 'INPUT_AZURE_DEVOPS_PROJECT', required: false },
  azureDevOpsRepository: { envVar: 'INPUT_AZURE_DEVOPS_REPOSITORY', required: false },
  azureDevOpsPullRequestId: {
    envVar: 'INPUT_AZURE_DEVOPS_PULL_REQUEST_ID',
    required: false,
    transform: (val: string) => parseInt(val, 10),
  },
  azureDevOpsWorkItemId: {
    envVar: 'INPUT_AZURE_DEVOPS_WORK_ITEM_ID',
    required: false,
    transform: (val: string) => parseInt(val, 10),
  },
  azureDevOpsBuildId: {
    envVar: 'INPUT_AZURE_DEVOPS_BUILD_ID',
    required: false,
    transform: (val: string) => parseInt(val, 10),
  },
  platform: { envVar: 'INPUT_PLATFORM', required: false },
  // LLM Provider inputs
  llmProvider: { envVar: 'INPUT_LLM_PROVIDER', required: false },
  llmApiKey: { envVar: 'INPUT_LLM_API_KEY', required: false },
  llmBaseUrl: { envVar: 'INPUT_LLM_BASE_URL', required: false },
  llmTemperature: {
    envVar: 'INPUT_LLM_TEMPERATURE',
    required: false,
    transform: (val: string) => parseFloat(val),
  },
  llmMaxTokens: {
    envVar: 'INPUT_LLM_MAX_TOKENS',
    required: false,
    transform: (val: string) => parseInt(val, 10),
  },
  llmTimeout: {
    envVar: 'INPUT_LLM_TIMEOUT',
    required: false,
    transform: (val: string) => parseInt(val, 10),
  },
  // Comment posting configuration
  postComment: {
    envVar: 'INPUT_POST_COMMENT',
    required: false,
    transform: (val: string) => val.toLowerCase() === 'true',
  },
  commentType: { envVar: 'INPUT_COMMENT_TYPE', required: false },
  reviewEvent: { envVar: 'INPUT_REVIEW_EVENT', required: false },
  useInlineComments: {
    envVar: 'INPUT_USE_INLINE_COMMENTS',
    required: false,
    transform: (val: string) => val.toLowerCase() === 'true',
  },
  inlineCommentStrategy: { envVar: 'INPUT_INLINE_COMMENT_STRATEGY', required: false },
};

export const TEMPLATE_CONFIG = {
  DEFAULT_TEMPLATE_NAME: 'prompt.njk',
  MAX_TEMPLATE_SIZE: 128 * 1024, // 128KB
  MAX_DIFF_SIZE: 128 * 1024, // 128KB
};

export const PATHS = {
  TEMP_DIR: '/tmp',
  DIFF_FILE_PATTERN: 'pr-{pullNumber}-diff.patch',
  INSTRUCTION_FILE: '/tmp/generated-instruction.txt',
};

export const ERROR = {
  GITHUB: {
    API_ERROR: 'GitHub API request failed',
  },
  AZURE_DEVOPS: {
    API_ERROR: 'Azure DevOps API request failed',
    MISSING_CONFIG: 'Azure DevOps configuration is incomplete',
    INVALID_PLATFORM: 'Invalid platform specified',
  },
  INPUT: {
    CONFLICTING_INSTRUCTION_INPUTS: 'Cannot specify both instruction and instruction_file',
    CONFLICTING_INSTRUCTION_TEMPLATE:
      'Cannot use both instruction inputs and template inputs simultaneously',
    INVALID: 'Invalid action inputs',
    INVALID_CONTEXT_JSON: 'Invalid JSON in custom_context',
    MISMATCHED_PR_FIELDS: 'Both pull_number and repo_name are required for PR extraction',
    MISSING_INSTRUCTION_OR_TEMPLATE:
      'Either instruction/instruction_file or template_directory must be provided',
    REPO_FORMAT: 'Repository name must be in format "owner/repo"',
  },
  TEMPLATE: {
    MISSING_DIRECTORY: 'template_directory is required when using templates',
    NOT_FOUND: 'Template file not found',
    PATH_OUTSIDE_DIRECTORY: 'Template path is outside template directory',
    RENDER_ERROR: 'Failed to render template',
    TOO_LARGE: 'Template file exceeds maximum size',
  },
} as const;
