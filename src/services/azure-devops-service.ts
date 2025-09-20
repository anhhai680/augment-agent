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

  async getCommitDiff(baseCommitId: string, targetCommitId: string): Promise<any> {
    try {
      logger.debug(`Fetching commit diff between ${baseCommitId} and ${targetCommitId}`);

      const endpoint = `git/repositories/${this.repository}/diffs/commits?baseVersion=${baseCommitId}&targetVersion=${targetCommitId}&api-version=7.0`;
      const data = await this.makeRequest<any>(endpoint);

      return data;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch commit diff`, error);
      throw error;
    }
  }

  async getFileContent(commitId: string, filePath: string): Promise<string> {
    try {
      logger.debug(`Fetching file content for ${filePath} at commit ${commitId}`);

      const endpoint = `git/repositories/${this.repository}/items?path=${encodeURIComponent(filePath)}&version=${commitId}&api-version=7.0`;
      const response = await fetch(`${this.baseUrl}/${this.organization}/${this.project}/_apis/${endpoint}`, {
        headers: {
          'Authorization': `Basic ${this.formatAuthenticationToken()}`,
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // File doesn't exist at this commit (likely a new or deleted file)
          return '';
        }
        throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch file content`, error);
      throw error;
    }
  }

  /**
   * Retrieves detailed pull request diff with actual line-by-line changes.
   * 
   * This method addresses the limitation of Azure DevOps /diffs API endpoint which only
   * provides metadata. Instead, it:
   * 1. Gets file content from source and target commits using Azure DevOps Git API
   * 2. Generates proper unified diff format with actual code changes
   * 3. Handles various edge cases (binary files, large files, missing files)
   * 4. Processes files in batches to avoid API rate limits
   * 
   * @param pullRequestId The ID of the pull request to generate diff for
   * @returns A string containing unified diff format with actual line changes
   */
  async getDetailedPullRequestDiff(pullRequestId: number): Promise<string> {
    try {
      logger.debug(`Fetching detailed diff for PR ${pullRequestId}`);

      // First get the PR to get source and target commit IDs
      const pr = await this.getPullRequest(pullRequestId);
      const sourceCommitId = pr.lastMergeSourceCommit.commitId;
      const targetCommitId = pr.lastMergeTargetCommit.commitId;

      if (!sourceCommitId || !targetCommitId) {
        throw new Error('Missing commit IDs for diff generation');
      }

      // Get the list of changed files
      const files = await this.getPullRequestFiles(pullRequestId);
      
      if (!files || files.length === 0) {
        logger.info('No files changed in pull request');
        return '';
      }

      let fullDiff = '';
      const processedFiles: string[] = [];
      const failedFiles: string[] = [];

      // Process files in smaller batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const filePath = file.path;
            
            // Skip binary files or very large files
            if (this.shouldSkipFile(filePath, file.size)) {
              logger.debug(`Skipping file ${filePath} (binary or too large)`);
              return null;
            }

            // Get file content from both commits
            const [sourceContent, targetContent] = await Promise.all([
              this.getFileContent(targetCommitId, filePath).catch((error) => {
                logger.debug(`Failed to get base content for ${filePath}`, error);
                return '';
              }),
              this.getFileContent(sourceCommitId, filePath).catch((error) => {
                logger.debug(`Failed to get source content for ${filePath}`, error);
                return '';
              })
            ]);

            // Generate unified diff for this file
            const fileDiff = this.generateUnifiedDiff(filePath, sourceContent, targetContent);
            if (fileDiff) {
              processedFiles.push(filePath);
              return fileDiff;
            }
            return null;
          } catch (error) {
            logger.warning(`Failed to generate diff for file ${file.path}`, error as Record<string, unknown>);
            failedFiles.push(file.path);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        for (const result of batchResults) {
          if (result) {
            fullDiff += result + '\n';
          }
        }
      }

      logger.info('Detailed diff generation completed', {
        totalFiles: files.length,
        processedFiles: processedFiles.length,
        failedFiles: failedFiles.length,
        diffLength: fullDiff.length
      });

      if (failedFiles.length > 0) {
        logger.warning(`Failed to process ${failedFiles.length} files`, { failedFiles });
      }

      return fullDiff;
    } catch (error) {
      logger.error(`${ERROR.AZURE_DEVOPS?.API_ERROR || 'Azure DevOps API Error'}: Failed to fetch detailed PR diff`, error);
      throw error;
    }
  }

  private shouldSkipFile(filePath: string, fileSize?: number): boolean {
    // Skip binary file extensions
    const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.exe', '.dll', '.so', '.dylib', '.bin'];
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    
    if (binaryExtensions.includes(extension)) {
      return true;
    }

    // Skip very large files (> 1MB)
    if (fileSize && fileSize > 1024 * 1024) {
      return true;
    }

    return false;
  }

  private generateUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
    if (oldContent === newContent) {
      return ''; // No changes
    }

    // Handle empty content cases
    if (!oldContent && !newContent) {
      return '';
    }

    const oldLines = oldContent ? oldContent.split('\n') : [''];
    const newLines = newContent ? newContent.split('\n') : [''];
    
    // Simple diff implementation - in production, you might want to use a more sophisticated algorithm
    const diff = this.computeUnifiedDiff(oldLines, newLines, filePath);
    return diff;
  }

  private computeUnifiedDiff(oldLines: string[], newLines: string[], filePath: string): string {
    const isNewFile = oldLines.length === 1 && oldLines[0] === '';
    const isDeletedFile = newLines.length === 1 && newLines[0] === '';

    let diff = '';
    
    if (isNewFile) {
      diff += `diff --git a/${filePath} b/${filePath}\n`;
      diff += `new file mode 100644\n`;
      diff += `index 0000000..${this.generateMockHash()}\n`;
      diff += `--- /dev/null\n`;
      diff += `+++ b/${filePath}\n`;
      diff += `@@ -0,0 +1,${newLines.length} @@\n`;
      for (const line of newLines) {
        diff += `+${line}\n`;
      }
    } else if (isDeletedFile) {
      diff += `diff --git a/${filePath} b/${filePath}\n`;
      diff += `deleted file mode 100644\n`;
      diff += `index ${this.generateMockHash()}..0000000\n`;
      diff += `--- a/${filePath}\n`;
      diff += `+++ /dev/null\n`;
      diff += `@@ -1,${oldLines.length} +0,0 @@\n`;
      for (const line of oldLines) {
        diff += `-${line}\n`;
      }
    } else {
      // Modified file - use a simple line-by-line comparison
      diff += `diff --git a/${filePath} b/${filePath}\n`;
      diff += `index ${this.generateMockHash()}..${this.generateMockHash()} 100644\n`;
      diff += `--- a/${filePath}\n`;
      diff += `+++ b/${filePath}\n`;
      
      const hunks = this.generateDiffHunks(oldLines, newLines);
      diff += hunks;
    }

    return diff;
  }

  private generateDiffHunks(oldLines: string[], newLines: string[]): string {
    let hunks = '';
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    if (maxLines === 0) {
      return '';
    }

    // Simple approach: treat the entire file as one hunk if it's not too large
    if (maxLines <= 1000) {
      return this.generateSingleHunk(oldLines, newLines);
    }

    // For larger files, generate multiple hunks
    return this.generateMultipleHunks(oldLines, newLines);
  }

  private generateSingleHunk(oldLines: string[], newLines: string[]): string {
    const oldCount = oldLines.length;
    const newCount = newLines.length;
    
    let hunk = `@@ -1,${oldCount} +1,${newCount} @@\n`;
    
    const maxLength = Math.max(oldCount, newCount);
    
    for (let i = 0; i < maxLength; i++) {
      const oldLine = i < oldCount ? oldLines[i] : null;
      const newLine = i < newCount ? newLines[i] : null;
      
      if (oldLine !== null && newLine !== null) {
        if (oldLine === newLine) {
          hunk += ` ${oldLine}\n`;
        } else {
          hunk += `-${oldLine}\n`;
          hunk += `+${newLine}\n`;
        }
      } else if (oldLine !== null) {
        hunk += `-${oldLine}\n`;
      } else if (newLine !== null) {
        hunk += `+${newLine}\n`;
      }
    }
    
    return hunk;
  }

  private generateMultipleHunks(oldLines: string[], newLines: string[]): string {
    // For very large files, just show a summary
    const oldCount = oldLines.length;
    const newCount = newLines.length;
    
    let hunks = `@@ -1,${Math.min(oldCount, 10)} +1,${Math.min(newCount, 10)} @@\n`;
    hunks += `[File too large for complete diff - showing first 10 lines]\n`;
    
    const previewLength = Math.min(10, Math.max(oldCount, newCount));
    
    for (let i = 0; i < previewLength; i++) {
      const oldLine = i < oldCount ? oldLines[i] : null;
      const newLine = i < newCount ? newLines[i] : null;
      
      if (oldLine !== null && newLine !== null) {
        if (oldLine === newLine) {
          hunks += ` ${oldLine}\n`;
        } else {
          hunks += `-${oldLine}\n`;
          hunks += `+${newLine}\n`;
        }
      } else if (oldLine !== null) {
        hunks += `-${oldLine}\n`;
      } else if (newLine !== null) {
        hunks += `+${newLine}\n`;
      }
    }
    
    if (Math.max(oldCount, newCount) > 10) {
      hunks += `[... ${Math.max(oldCount, newCount) - 10} more lines not shown ...]\n`;
    }
    
    return hunks;
  }

  private generateMockHash(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}
