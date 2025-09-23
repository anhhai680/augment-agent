/**
 * Azure DevOps context-related type definitions
 */

import { AzureDevOpsPullRequestFile } from './azure-devops.js';

export interface AzureDevOpsRepo {
  organization: string;
  project: string;
  repository: string;
  full_name: string;
}

export interface AzureDevOpsRef {
  ref: string;
  commitId: string;
  repo: AzureDevOpsRepo;
}

export interface AzureDevOpsPRData {
  pullRequestId: number;
  codeReviewId: number;
  title: string;
  description: string;
  author: string;
  status: string;
  sourceRef: AzureDevOpsRef;
  targetRef: AzureDevOpsRef;
  creationDate: string;
  changed_files: string; // Newline-separated list of filenames
  changed_files_list: Array<AzureDevOpsPullRequestFile>;
  diff_file: string;
  reviewers: Array<{
    displayName: string;
    vote: number;
    hasDeclined: boolean;
    isRequired: boolean;
  }>;
}

export interface AzureDevOpsWorkItemData {
  id: number;
  title: string;
  description: string;
  workItemType: string;
  state: string;
  assignedTo: string;
  createdBy: string;
  createdDate: string;
  changedBy: string;
  changedDate: string;
  teamProject: string;
  areaPath: string;
  iterationPath: string;
  priority: number;
  severity: string;
  tags: string;
}

export interface AzureDevOpsBuildData {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  queueTime: string;
  startTime: string;
  finishTime: string;
  sourceBranch: string;
  sourceVersion: string;
  requestedBy: string;
  requestedFor: string;
  definition: {
    id: number;
    name: string;
    type: string;
  };
  project: {
    id: string;
    name: string;
  };
}

export interface AzureDevOpsTemplateContext {
  // PR-related context (if PR info provided)
  pr?: AzureDevOpsPRData;

  // Work Item context (if work item info provided)
  workItem?: AzureDevOpsWorkItemData;

  // Build context (if build info provided)
  build?: AzureDevOpsBuildData;

  // Custom context (parsed from JSON)
  custom?: Record<string, any>;

  // Platform information
  platform: 'azure-devops';
}
