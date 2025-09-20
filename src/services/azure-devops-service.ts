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
    // Validate required configuration
    if (!config.token) {
      throw new Error('Azure DevOps PAT token is required');
    }
    if (!config.organization) {
      throw new Error('Azure DevOps organization is required');
    }
    if (!config.project) {
      throw new Error('Azure DevOps project is required');
    }
    if (!config.repository) {
      throw new Error('Azure DevOps repository is required');
    }

    this.token = config.token;
    this.organization = config.organization;
    this.project = config.project;
    this.repository = config.repository;
    this.baseUrl = config.baseUrl || `https://dev.azure.com/${config.organization}`;

    // Validate token format early
    this.validateToken();
  }

  /**
   * Validates the PAT token format
   * @private
   */
  private validateToken(): void {
    let token = this.token;
    
    // Extract token if it contains username:token format
    if (this.token.includes(':')) {
      const parts = this.token.split(':');
      if (parts.length >= 2 && parts[1]) {
        token = parts[1]; // Get the token part after the username
      }
    }
    
    // Check minimum length
    if (token.length < 52) {
      logger.warning(
        `PAT token appears to be shorter than expected Azure DevOps PAT format (${token.length} characters). ` +
        `Azure DevOps PATs are typically 52+ characters for classic format or 84 characters for new format.`
      );
    }

    // Check for new Azure DevOps PAT format
    if (token.length === 84) {
      const signature = token.substring(75, 79);
      if (signature === 'AZDO') {
        logger.debug('Detected new Azure DevOps PAT format with AZDO signature');
      } else {
        logger.warning('Token is 84 characters but does not contain expected AZDO signature at positions 76-79');
      }
    }

    // Check for suspicious patterns
    if (token.includes(' ') || token.includes('\n') || token.includes('\t')) {
      throw new Error('PAT token contains invalid whitespace characters');
    }

    // Basic character validation (Azure DevOps PATs use base64-like characters)
    const validTokenPattern = /^[A-Za-z0-9+/=]+$/;
    if (!validTokenPattern.test(token)) {
      throw new Error('PAT token contains invalid characters. Expected alphanumeric characters with +, /, and = only');
    }
  }

  /**
   * Validates and formats PAT token for Azure DevOps authentication
   * Azure DevOps PATs should be used with Basic authentication in the format:
   * - For direct PAT: Base64 encode ":token" (empty username)
   * - For username:token format: Base64 encode "username:token"
   * @private
   */
  private formatAuthenticationToken(): string {
    if (!this.token) {
      throw new Error('Azure DevOps PAT token is required');
    }

    // Check if token already contains username:token format
    if (this.token.includes(':')) {
      // Token already has username prefix, use as-is
      return Buffer.from(this.token).toString('base64');
    }

    // Use empty username with PAT (recommended format for Azure DevOps)
    return Buffer.from(`:${this.token}`).toString('base64');
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/${this.organization}/${this.project}/_apis/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${this.formatAuthenticationToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // Enhanced error handling for authentication issues
        if (response.status === 401) {
          throw new Error(
            `Azure DevOps authentication failed (401 Unauthorized). ` +
            `Please verify your PAT token has the required permissions and is not expired. ` +
            `Ensure the token format is correct (should be 52+ characters for classic PATs or 84 characters for new format).`
          );
        } else if (response.status === 403) {
          throw new Error(
            `Azure DevOps access forbidden (403 Forbidden). ` +
            `Your PAT token may lack the necessary scopes for this operation. ` +
            `Verify the token has appropriate permissions for the requested resource.`
          );
        } else if (response.status === 404) {
          throw new Error(
            `Azure DevOps resource not found (404). ` +
            `Verify the organization '${this.organization}', project '${this.project}', ` +
            `and repository '${this.repository}' exist and are accessible.`
          );
        }
        
        throw new Error(`Azure DevOps API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { value?: T } & T;
      return data.value || data;
    } catch (error) {
      // Log detailed error information for debugging
      const errorContext = {
        endpoint,
        organization: this.organization,
        project: this.project,
        repository: this.repository,
        tokenLength: this.token.length,
        tokenHasUsername: this.token.includes(':')
      };
      
      logger.error(
        `${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch from ${endpoint}`,
        error,
        errorContext
      );
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
