/**
 * Azure DevOps API types for PR and Work Item information extraction
 */

export interface AzureDevOpsPullRequest {
  pullRequestId: number;
  codeReviewId: number;
  status: string;
  createdBy: {
    id: string;
    displayName: string;
    uniqueName: string;
    url: string;
    imageUrl: string;
  };
  creationDate: string;
  title: string;
  description: string;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: string;
  mergeId: string;
  lastMergeSourceCommit: {
    commitId: string;
    url: string;
  };
  lastMergeTargetCommit: {
    commitId: string;
    url: string;
  };
  lastMergeCommit: {
    commitId: string;
    url: string;
  };
  reviewers: Array<{
    reviewerUrl: string;
    vote: number;
    hasDeclined: boolean;
    isFlagged: boolean;
    displayName: string;
    url: string;
    id: string;
    imageUrl: string;
    uniqueName: string;
    isRequired: boolean;
  }>;
  url: string;
  supportsIterations: boolean;
  artifactId: string;
}

export interface AzureDevOpsPullRequestFile {
  objectId: string;
  gitObjectType: string;
  commitId: string;
  path: string;
  url: string;
  size: number;
  isFolder: boolean;
  isSymbolicLink: boolean;
  contentMetadata: {
    fileName: string;
    extension: string;
    encoding: number;
    contentType: string;
    vsLink: string;
  };
}

export interface AzureDevOpsPullRequestDiff {
  allChangesIncluded: boolean;
  changeCounts: {
    Add: number;
    Edit: number;
    Delete: number;
  };
  changes: Array<{
    item: {
      objectId: string;
      originalObjectId: string;
      gitObjectType: string;
      commitId: string;
      path: string;
      url: string;
      size: number;
      isFolder: boolean;
      isSymbolicLink: boolean;
    };
    changeType: string;
  }>;
  commonCommit: string;
  baseCommit: string;
  targetCommit: string;
  aheadCount: number;
  behindCount: number;
}

export interface AzureDevOpsWorkItem {
  id: number;
  rev: number;
  fields: {
    'System.Title': string;
    'System.Description': string;
    'System.State': string;
    'System.WorkItemType': string;
    'System.AssignedTo': {
      displayName: string;
      url: string;
      _links: {
        avatar: {
          href: string;
        };
      };
      id: string;
      uniqueName: string;
      imageUrl: string;
      descriptor: string;
    };
    'System.CreatedBy': {
      displayName: string;
      url: string;
      _links: {
        avatar: {
          href: string;
        };
      };
      id: string;
      uniqueName: string;
      imageUrl: string;
      descriptor: string;
    };
    'System.CreatedDate': string;
    'System.ChangedBy': {
      displayName: string;
      url: string;
      _links: {
        avatar: {
          href: string;
        };
      };
      id: string;
      uniqueName: string;
      imageUrl: string;
      descriptor: string;
    };
    'System.ChangedDate': string;
    'System.TeamProject': string;
    'System.AreaPath': string;
    'System.IterationPath': string;
    'System.WorkItemType': string;
    'System.State': string;
    'System.Reason': string;
    'System.Priority': number;
    'System.Severity': string;
    'System.Tags': string;
  };
  _links: {
    self: {
      href: string;
    };
    workItemUpdates: {
      href: string;
    };
    workItemRevisions: {
      href: string;
    };
    workItemComments: {
      href: string;
    };
    html: {
      href: string;
    };
    workItemType: {
      href: string;
    };
    fields: {
      href: string;
    };
  };
  url: string;
}

export interface AzureDevOpsBuildInfo {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  queueTime: string;
  startTime: string;
  finishTime: string;
  url: string;
  definition: {
    id: number;
    name: string;
    url: string;
    path: string;
    type: string;
    queueStatus: string;
    revision: number;
    project: {
      id: string;
      name: string;
      url: string;
      state: string;
      revision: number;
      visibility: string;
      lastUpdateTime: string;
    };
  };
  project: {
    id: string;
    name: string;
    url: string;
    state: string;
    revision: number;
    visibility: string;
    lastUpdateTime: string;
  };
  sourceVersion: string;
  sourceBranch: string;
  sourceVersionDisplayUri: string;
  requestedBy: {
    displayName: string;
    url: string;
    _links: {
      avatar: {
        href: string;
      };
    };
    id: string;
    uniqueName: string;
    imageUrl: string;
    descriptor: string;
  };
  requestedFor: {
    displayName: string;
    url: string;
    _links: {
      avatar: {
        href: string;
      };
    };
    id: string;
    uniqueName: string;
    imageUrl: string;
    descriptor: string;
  };
  lastChangedBy: {
    displayName: string;
    url: string;
    _links: {
      avatar: {
        href: string;
      };
    };
    id: string;
    uniqueName: string;
    imageUrl: string;
    descriptor: string;
  };
  lastChangedOn: string;
  hasDiagnostics: boolean;
  logs: {
    id: number;
    type: string;
    url: string;
  };
  repository: {
    id: string;
    type: string;
    name: string;
    url: string;
    clean: boolean;
    checkoutSubmodules: boolean;
  };
  keepForever: boolean;
  retainedByRelease: boolean;
  triggeredByBuild: any;
}

export interface AzureDevOpsPipelineInfo {
  id: number;
  name: string;
  url: string;
  path: string;
  type: string;
  queueStatus: string;
  revision: number;
  project: {
    id: string;
    name: string;
    url: string;
    state: string;
    revision: number;
    visibility: string;
    lastUpdateTime: string;
  };
  quality: string;
  authoredBy: {
    displayName: string;
    url: string;
    _links: {
      avatar: {
        href: string;
      };
    };
    id: string;
    uniqueName: string;
    imageUrl: string;
    descriptor: string;
  };
  drafts: any[];
  queue: {
    id: number;
    name: string;
    pool: {
      id: number;
      name: string;
      isHosted: boolean;
    };
  };
  latestBuild: AzureDevOpsBuildInfo;
  latestCompletedBuild: AzureDevOpsBuildInfo;
}
