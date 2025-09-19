/**
 * Azure DevOps API service for PR and Work Item information extraction
 */

import { AzureDevOpsPullRequest, AzureDevOpsPullRequestFile, AzureDevOpsPullRequestDiff, AzureDevOpsWorkItem, AzureDevOpsBuildInfo, AzureDevOpsPipelineInfo } from '../types/azure-devops.js';
import { TEMPLATE_CONFIG, ERROR } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class AzureDevOpsService {
  private baseUrl: string;
  private organization: string;
  private project: string;
  private repository: string;
  private token: string;

  constructor(config: { 
    token: string; 
    organization: string; 
    project: string; 
    repository: string;
    baseUrl?: string;
  }) {
    this.token = config.token;
    this.organization = config.organization;
    this.project = config.project;
    this.repository = config.repository;
    this.baseUrl = config.baseUrl || `https://dev.azure.com/${config.organization}`;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/${this.organization}/${this.project}/_apis/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.token}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.value || data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch from ${endpoint}`, error);
      throw error;
    }
  }

  async getPullRequest(pullRequestId: number): Promise<AzureDevOpsPullRequest> {
    try {
      logger.debug(`Fetching PR ${pullRequestId} from ${this.organization}/${this.project}/${this.repository}`);

      const endpoint = `git/repositories/${this.repository}/pullrequests/${pullRequestId}?api-version=7.0`;
      const data = await this.makeRequest<AzureDevOpsPullRequest>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch PR ${pullRequestId}`, error);
      throw error;
    }
  }

  async getPullRequestFiles(pullRequestId: number): Promise<AzureDevOpsPullRequestFile[]> {
    try {
      logger.debug(`Fetching files for PR ${pullRequestId}`);

      const endpoint = `git/repositories/${this.repository}/pullrequests/${pullRequestId}/files?api-version=7.0`;
      const data = await this.makeRequest<AzureDevOpsPullRequestFile[]>(endpoint);

      logger.info(`Successfully fetched PR files`, {
        pullRequestId,
        totalFiles: data.length,
      });

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch PR files`, error);
      throw error;
    }
  }

  async getPullRequestDiff(pullRequestId: number): Promise<AzureDevOpsPullRequestDiff> {
    try {
      logger.debug(`Fetching diff for PR ${pullRequestId}`);

      const endpoint = `git/repositories/${this.repository}/pullrequests/${pullRequestId}/diffs?api-version=7.0`;
      const data = await this.makeRequest<AzureDevOpsPullRequestDiff>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch PR diff`, error);
      throw error;
    }
  }

  async getWorkItem(workItemId: number): Promise<AzureDevOpsWorkItem> {
    try {
      logger.debug(`Fetching work item ${workItemId}`);

      const endpoint = `wit/workitems/${workItemId}?api-version=7.0`;
      const data = await this.makeRequest<AzureDevOpsWorkItem>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch work item ${workItemId}`, error);
      throw error;
    }
  }

  async getBuildInfo(buildId: number): Promise<AzureDevOpsBuildInfo> {
    try {
      logger.debug(`Fetching build info ${buildId}`);

      const endpoint = `build/builds/${buildId}?api-version=7.0`;
      const data = await this.makeRequest<AzureDevOpsBuildInfo>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch build info ${buildId}`, error);
      throw error;
    }
  }

  async getPipelineInfo(pipelineId: number): Promise<AzureDevOpsPipelineInfo> {
    try {
      logger.debug(`Fetching pipeline info ${pipelineId}`);

      const endpoint = `build/definitions/${pipelineId}?api-version=7.0`;
      const data = await this.makeRequest<AzureDevOpsPipelineInfo>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch pipeline info ${pipelineId}`, error);
      throw error;
    }
  }

  async getPullRequestCommits(pullRequestId: number): Promise<any[]> {
    try {
      logger.debug(`Fetching commits for PR ${pullRequestId}`);

      const endpoint = `git/repositories/${this.repository}/pullrequests/${pullRequestId}/commits?api-version=7.0`;
      const data = await this.makeRequest<any[]>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch PR commits`, error);
      throw error;
    }
  }

  async getPullRequestThreads(pullRequestId: number): Promise<any[]> {
    try {
      logger.debug(`Fetching threads for PR ${pullRequestId}`);

      const endpoint = `git/repositories/${this.repository}/pullrequests/${pullRequestId}/threads?api-version=7.0`;
      const data = await this.makeRequest<any[]>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch PR threads`, error);
      throw error;
    }
  }
}
