/**
 * Azure DevOps context extractor for template processing
 */

import { AzureDevOpsService } from '../../services/azure-devops-service.js';
import { AzureDevOpsPRData, AzureDevOpsWorkItemData, AzureDevOpsBuildData } from '../../types/azure-devops-context.js';
import { AzureDevOpsPullRequest, AzureDevOpsPullRequestFile, AzureDevOpsPullRequestDiff } from '../../types/azure-devops.js';
import { FileUtils } from '../../utils/file-utils.js';
import { logger } from '../../utils/logger.js';
import { PATHS, TEMPLATE_CONFIG } from '../../config/constants.js';
import { BaseExtractor } from './base-extractor.js';
import type { ActionInputs } from '../../types/inputs.js';

export class AzureDevOpsContextExtractor extends BaseExtractor<any> {
  private azureDevOpsService: AzureDevOpsService;
  private readonly organization: string;
  private readonly project: string;
  private readonly repository: string;

  constructor(inputs: ActionInputs) {
    super('Azure DevOps Context');
    
    if (!inputs.azureDevOpsToken || !inputs.azureDevOpsOrganization || !inputs.azureDevOpsProject || !inputs.azureDevOpsRepository) {
      throw new Error('Azure DevOps configuration is incomplete. Required: token, organization, project, repository');
    }

    this.organization = inputs.azureDevOpsOrganization;
    this.project = inputs.azureDevOpsProject;
    this.repository = inputs.azureDevOpsRepository;

    this.azureDevOpsService = new AzureDevOpsService({
      token: inputs.azureDevOpsToken,
      organization: this.organization,
      project: this.project,
      repository: this.repository,
    });
  }

  shouldExtract(inputs: ActionInputs): boolean {
    return inputs.platform === 'azure-devops' && !!(
      inputs.azureDevOpsPullRequestId || 
      inputs.azureDevOpsWorkItemId || 
      inputs.azureDevOpsBuildId
    );
  }

  protected async performExtraction(inputs: ActionInputs): Promise<any> {
    // This method would contain the actual extraction logic
    // For now, return the inputs to satisfy the interface
    return inputs;
  }

  async extractPRData(inputs: ActionInputs): Promise<AzureDevOpsPRData | null> {
    if (!inputs.azureDevOpsPullRequestId) {
      logger.debug('No Azure DevOps pull request ID provided');
      return null;
    }

    try {
      logger.info('Extracting Azure DevOps PR data', {
        pullRequestId: inputs.azureDevOpsPullRequestId,
      });

      const [pr, files, diff] = await Promise.all([
        this.azureDevOpsService.getPullRequest(inputs.azureDevOpsPullRequestId),
        this.azureDevOpsService.getPullRequestFiles(inputs.azureDevOpsPullRequestId),
        this.azureDevOpsService.getPullRequestDiff(inputs.azureDevOpsPullRequestId),
      ]);

      const changedFiles = files.map(file => file.path).join('\n');
      const diffFilePath = await this.writeDiffFile(diff);

      const prData: AzureDevOpsPRData = {
        pullRequestId: pr.pullRequestId,
        codeReviewId: pr.codeReviewId,
        title: pr.title,
        description: pr.description || '',
        author: pr.createdBy.displayName,
        status: pr.status,
        sourceRef: {
          ref: pr.sourceRefName,
          commitId: pr.lastMergeSourceCommit.commitId,
          repo: {
            organization: this.organization,
            project: this.project,
            repository: this.repository,
            full_name: `${this.organization}/${this.project}/${this.repository}`,
          },
        },
        targetRef: {
          ref: pr.targetRefName,
          commitId: pr.lastMergeTargetCommit.commitId,
          repo: {
            organization: this.organization,
            project: this.project,
            repository: this.repository,
            full_name: `${this.organization}/${this.project}/${this.repository}`,
          },
        },
        creationDate: pr.creationDate,
        changed_files: changedFiles,
        changed_files_list: files,
        diff_file: diffFilePath,
        reviewers: pr.reviewers.map(reviewer => ({
          displayName: reviewer.displayName,
          vote: reviewer.vote,
          hasDeclined: reviewer.hasDeclined,
          isRequired: reviewer.isRequired,
        })),
      };

      logger.info('Azure DevOps PR data extracted successfully', {
        pullRequestId: prData.pullRequestId,
        title: prData.title,
        filesCount: files.length,
      });

      return prData;
    } catch (error) {
      logger.error('Failed to extract Azure DevOps PR data', error);
      throw error;
    }
  }

  async extractWorkItemData(inputs: ActionInputs): Promise<AzureDevOpsWorkItemData | null> {
    if (!inputs.azureDevOpsWorkItemId) {
      logger.debug('No Azure DevOps work item ID provided');
      return null;
    }

    try {
      logger.info('Extracting Azure DevOps work item data', {
        workItemId: inputs.azureDevOpsWorkItemId,
      });

      const workItem = await this.azureDevOpsService.getWorkItem(inputs.azureDevOpsWorkItemId);

      const workItemData: AzureDevOpsWorkItemData = {
        id: workItem.id,
        title: workItem.fields['System.Title'],
        description: workItem.fields['System.Description'] || '',
        workItemType: workItem.fields['System.WorkItemType'],
        state: workItem.fields['System.State'],
        assignedTo: workItem.fields['System.AssignedTo']?.displayName || '',
        createdBy: workItem.fields['System.CreatedBy']?.displayName || '',
        createdDate: workItem.fields['System.CreatedDate'],
        changedBy: workItem.fields['System.ChangedBy']?.displayName || '',
        changedDate: workItem.fields['System.ChangedDate'],
        teamProject: workItem.fields['System.TeamProject'],
        areaPath: workItem.fields['System.AreaPath'],
        iterationPath: workItem.fields['System.IterationPath'],
        priority: workItem.fields['System.Priority'] || 0,
        severity: workItem.fields['System.Severity'] || '',
        tags: workItem.fields['System.Tags'] || '',
      };

      logger.info('Azure DevOps work item data extracted successfully', {
        workItemId: workItemData.id,
        title: workItemData.title,
        workItemType: workItemData.workItemType,
      });

      return workItemData;
    } catch (error) {
      logger.error('Failed to extract Azure DevOps work item data', error);
      throw error;
    }
  }

  async extractBuildData(inputs: ActionInputs): Promise<AzureDevOpsBuildData | null> {
    if (!inputs.azureDevOpsBuildId) {
      logger.debug('No Azure DevOps build ID provided');
      return null;
    }

    try {
      logger.info('Extracting Azure DevOps build data', {
        buildId: inputs.azureDevOpsBuildId,
      });

      const build = await this.azureDevOpsService.getBuildInfo(inputs.azureDevOpsBuildId);

      const buildData: AzureDevOpsBuildData = {
        id: build.id,
        buildNumber: build.buildNumber,
        status: build.status,
        result: build.result,
        queueTime: build.queueTime,
        startTime: build.startTime,
        finishTime: build.finishTime,
        sourceBranch: build.sourceBranch,
        sourceVersion: build.sourceVersion,
        requestedBy: build.requestedBy.displayName,
        requestedFor: build.requestedFor.displayName,
        definition: {
          id: build.definition.id,
          name: build.definition.name,
          type: build.definition.type,
        },
        project: {
          id: build.project.id,
          name: build.project.name,
        },
      };

      logger.info('Azure DevOps build data extracted successfully', {
        buildId: buildData.id,
        buildNumber: buildData.buildNumber,
        status: buildData.status,
      });

      return buildData;
    } catch (error) {
      logger.error('Failed to extract Azure DevOps build data', error);
      throw error;
    }
  }

  private async writeDiffFile(diff: AzureDevOpsPullRequestDiff): Promise<string> {
    try {
      // Convert Azure DevOps diff format to standard patch format
      let patchContent = '';
      
      if (diff.changes) {
        for (const change of diff.changes) {
          const changeType = change.changeType;
          const path = change.item.path;
          
          switch (changeType) {
            case 'add':
              patchContent += `diff --git a/${path} b/${path}\n`;
              patchContent += `new file mode 100644\n`;
              patchContent += `index 0000000..${change.item.objectId.substring(0, 7)}\n`;
              patchContent += `--- /dev/null\n`;
              patchContent += `+++ b/${path}\n`;
              break;
            case 'delete':
              patchContent += `diff --git a/${path} b/${path}\n`;
              patchContent += `deleted file mode 100644\n`;
              patchContent += `index ${change.item.originalObjectId.substring(0, 7)}..0000000\n`;
              patchContent += `--- a/${path}\n`;
              patchContent += `+++ /dev/null\n`;
              break;
            case 'edit':
              patchContent += `diff --git a/${path} b/${path}\n`;
              patchContent += `index ${change.item.originalObjectId.substring(0, 7)}..${change.item.objectId.substring(0, 7)} 100644\n`;
              patchContent += `--- a/${path}\n`;
              patchContent += `+++ b/${path}\n`;
              break;
          }
        }
      }

      const diffFilePath = PATHS.INSTRUCTION_FILE.replace('.txt', '-azure-devops-diff.patch');
      await FileUtils.writeFile(diffFilePath, patchContent);

      logger.debug('Azure DevOps diff file written', {
        filePath: diffFilePath,
        contentLength: patchContent.length,
      });

      return diffFilePath;
    } catch (error) {
      logger.error('Failed to write Azure DevOps diff file', error);
      throw error;
    }
  }
}
