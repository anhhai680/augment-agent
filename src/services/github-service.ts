/**
 * GitHub API service for PR information extraction
 */

import { Octokit } from '@octokit/rest';
import { PullRequestInfo, PullRequestFile, PullRequestDiff } from '../types/github.js';
import { GitHubReviewComment } from '../types/review.js';
import { TEMPLATE_CONFIG, ERROR } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: { token: string; owner: string; repo: string }) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async getPullRequest(pullNumber: number): Promise<PullRequestInfo> {
    try {
      logger.debug(`Fetching PR ${pullNumber} from ${this.owner}/${this.repo}`);

      const { data } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
      });

      return {
        number: data.number,
        title: data.title,
        body: data.body,
        state: data.state,
        user: { login: data.user?.login || 'unknown' },
        head: {
          ref: data.head.ref,
          sha: data.head.sha,
          repo: {
            full_name: data.head.repo.full_name,
            name: data.head.repo.name,
            owner: {
              login: data.head.repo.owner.login,
            },
          },
        },
        base: {
          ref: data.base.ref,
          sha: data.base.sha,
          repo: {
            full_name: data.base.repo.full_name,
            name: data.base.repo.name,
            owner: {
              login: data.base.repo.owner.login,
            },
          },
        },
      };
    } catch (error) {
      logger.error(`${ERROR.GITHUB.API_ERROR}: Failed to fetch PR ${pullNumber}`, error);
      throw error;
    }
  }

  async getPullRequestFiles(pullNumber: number): Promise<PullRequestFile[]> {
    try {
      logger.debug(`Fetching files for PR ${pullNumber}`);

      const allFiles: PullRequestFile[] = [];
      let page = 1;
      const perPage = 100; // GitHub's maximum per page

      while (true) {
        logger.debug(`Fetching PR files page ${page}`, {
          pullNumber,
          page,
          perPage,
        });

        const { data } = await this.octokit.rest.pulls.listFiles({
          owner: this.owner,
          repo: this.repo,
          pull_number: pullNumber,
          per_page: perPage,
          page,
        });

        // Map and add files from this page
        const pageFiles = data.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
        }));

        allFiles.push(...pageFiles);

        logger.debug(`Fetched ${pageFiles.length} files from page ${page}`, {
          pullNumber,
          page,
          filesOnPage: pageFiles.length,
          totalFilesSoFar: allFiles.length,
        });

        // If we got fewer files than the page size, we've reached the end
        if (data.length < perPage) {
          break;
        }

        page++;
      }

      logger.info(`Successfully fetched all PR files`, {
        pullNumber,
        totalFiles: allFiles.length,
        totalPages: page,
      });

      return allFiles;
    } catch (error) {
      logger.error(`${ERROR.GITHUB.API_ERROR}: Failed to fetch PR files`, error);
      throw error;
    }
  }

  async getPullRequestDiff(pullNumber: number): Promise<PullRequestDiff> {
    try {
      logger.debug(`Fetching diff for PR ${pullNumber}`);

      const { data } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
        mediaType: { format: 'diff' },
      });

      const content = data as unknown as string;
      const size = Buffer.byteLength(content, 'utf8');
      const truncated = size > TEMPLATE_CONFIG.MAX_DIFF_SIZE;

      return {
        content: truncated ? content.substring(0, TEMPLATE_CONFIG.MAX_DIFF_SIZE) : content,
        size,
        truncated,
      };
    } catch (error) {
      logger.error(`${ERROR.GITHUB.API_ERROR}: Failed to fetch PR diff`, error);
      throw error;
    }
  }

  async createPullRequestComment(pullNumber: number, body: string): Promise<void> {
    try {
      logger.debug(`Creating comment on PR ${pullNumber}`);

      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: pullNumber,
        body,
      });

      logger.info(`Successfully created comment on PR ${pullNumber}`);
    } catch (error) {
      logger.error(
        `${ERROR.GITHUB.API_ERROR}: Failed to create comment on PR ${pullNumber}`,
        error
      );
      throw error;
    }
  }

  async createPullRequestReview(
    pullNumber: number,
    body: string,
    event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' = 'COMMENT'
  ): Promise<void> {
    try {
      logger.debug(`Creating review on PR ${pullNumber} with event: ${event}`);

      await this.octokit.rest.pulls.createReview({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
        body,
        event,
      });

      logger.info(`Successfully created review on PR ${pullNumber}`);
    } catch (error) {
      logger.error(`${ERROR.GITHUB.API_ERROR}: Failed to create review on PR ${pullNumber}`, error);
      throw error;
    }
  }

  async createPullRequestReviewWithComments(
    pullNumber: number,
    body: string,
    comments: GitHubReviewComment[] = [],
    event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' = 'COMMENT',
    commitId?: string
  ): Promise<void> {
    try {
      logger.debug(`Creating review with ${comments.length} inline comments on PR ${pullNumber}`);

      // Get the latest commit if not provided
      if (!commitId) {
        const prInfo = await this.getPullRequest(pullNumber);
        commitId = prInfo.head.sha;
        logger.debug(`Using commit SHA: ${commitId}`);
      }

      // Get PR files to validate paths and line numbers
      const prFiles = await this.getPullRequestFiles(pullNumber);
      const validPaths = new Set(prFiles.map(f => f.filename));
      logger.debug('Valid file paths in PR:', { validPaths: Array.from(validPaths) });

      // Get the actual diff to validate line numbers
      const diffData = await this.getPullRequestDiff(pullNumber);
      const validLines = this.extractValidLinesFromDiff(diffData.content);
      logger.debug('Valid diff lines extracted:', {
        fileCount: Object.keys(validLines).length,
        files: Object.keys(validLines),
      });

      // Filter out comments without required fields and validate against diff
      const validComments = comments
        .filter(comment => {
          if (!comment.line || !comment.path) {
            logger.debug(
              `Filtering out comment: missing line (${comment.line}) or path (${comment.path})`
            );
            return false;
          }
          if (!validPaths.has(comment.path)) {
            logger.warning(`File path "${comment.path}" not found in PR changes.`, {
              commentPath: comment.path,
              availablePaths: Array.from(validPaths),
            });
            return false;
          }

          // Check if the line number is valid in the diff
          const fileValidLines = validLines[comment.path];
          if (!fileValidLines || !fileValidLines.has(comment.line!)) {
            logger.warning(`Line ${comment.line} in "${comment.path}" is not part of the diff.`, {
              commentLine: comment.line,
              validLines: fileValidLines ? Array.from(fileValidLines).slice(0, 10) : [],
            });
            return false;
          }

          return true;
        })
        .map(comment => {
          const mappedComment: any = {
            path: comment.path,
            body: comment.body,
            line: comment.line!,
            side: comment.side || 'RIGHT',
          };

          if (comment.start_line !== undefined) {
            mappedComment.start_line = comment.start_line;
            mappedComment.start_side = comment.start_side || comment.side || 'RIGHT';
          }

          return mappedComment;
        });

      logger.info(`Filtered ${validComments.length} valid comments from ${comments.length} total`, {
        validComments: validComments.map(c => ({ path: c.path, line: c.line })),
      });

      if (validComments.length === 0) {
        logger.warning('No valid inline comments to post - all comments were filtered out');
        // Don't throw an error, just create a regular review with the summary
        await this.octokit.rest.pulls.createReview({
          owner: this.owner,
          repo: this.repo,
          pull_number: pullNumber,
          commit_id: commitId,
          body: body || 'Code review completed',
          event,
        });
        return;
      }

      const reviewData = {
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
        commit_id: commitId,
        body,
        event,
        comments: validComments,
      };

      logger.debug('Creating review with data:', reviewData);

      try {
        await this.octokit.rest.pulls.createReview(reviewData);
        logger.info(
          `Successfully created review with ${validComments.length} inline comments on PR ${pullNumber}`
        );
      } catch (apiError) {
        logger.error('GitHub API error when creating review with comments:', apiError);

        // If the API call fails, try to create a regular review instead
        logger.info('Falling back to regular review due to API error');
        await this.octokit.rest.pulls.createReview({
          owner: this.owner,
          repo: this.repo,
          pull_number: pullNumber,
          commit_id: commitId,
          body: `${body}\n\nNote: Attempted to post ${validComments.length} inline comments but encountered API issues.`,
          event,
        });

        // Re-throw the original error for debugging
        throw apiError;
      }
    } catch (error) {
      logger.error(
        `${ERROR.GITHUB.API_ERROR}: Failed to create review with comments on PR ${pullNumber}`,
        error
      );
      throw error;
    }
  }

  async createIndividualReviewComment(
    pullNumber: number,
    comment: GitHubReviewComment,
    commitId?: string
  ): Promise<void> {
    try {
      logger.debug(
        `Creating individual comment on ${comment.path}:${comment.line} for PR ${pullNumber}`
      );

      // Validate required fields
      if (!comment.line || !comment.path) {
        logger.warning('Skipping comment with missing line or path', {
          path: comment.path,
          line: comment.line,
        });
        return;
      }

      // Get the latest commit if not provided
      if (!commitId) {
        const prInfo = await this.getPullRequest(pullNumber);
        commitId = prInfo.head.sha;
      }

      const requestParams: any = {
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
        commit_id: commitId,
        path: comment.path,
        body: comment.body,
        line: comment.line,
        side: comment.side || 'RIGHT',
      };

      if (comment.start_line !== undefined) {
        requestParams.start_line = comment.start_line;
        requestParams.start_side = comment.start_side || comment.side || 'RIGHT';
      }

      await this.octokit.rest.pulls.createReviewComment(requestParams);

      logger.info(`Successfully created individual comment on ${comment.path}:${comment.line}`);
    } catch (error) {
      logger.error(
        `${ERROR.GITHUB.API_ERROR}: Failed to create individual comment on PR ${pullNumber}`,
        error
      );
      throw error;
    }
  }

  /**
   * Extract valid line numbers from diff data
   * Returns a map of file paths to sets of valid line numbers
   */
  private extractValidLinesFromDiff(diffData: string): Record<string, Set<number>> {
    const validLines: Record<string, Set<number>> = {};

    // Split diff into file sections
    const fileSections = diffData.split(/^diff --git /m).slice(1);

    for (const section of fileSections) {
      const lines = section.split('\n');

      // Extract file path from the first line
      const filePathMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
      if (!filePathMatch || !filePathMatch[2]) continue;

      const filePath = filePathMatch[2]; // Use the 'b/' path (destination)
      validLines[filePath] = new Set<number>();

      let currentLine = 0;
      let inHunk = false;

      for (const line of lines) {
        // Look for hunk headers like @@ -1,4 +1,6 @@
        const hunkMatch = line.match(/^@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (hunkMatch && hunkMatch[1]) {
          currentLine = parseInt(hunkMatch[1], 10);
          inHunk = true;
          continue;
        }

        if (!inHunk) continue;

        // Process lines in the hunk
        if (line.startsWith('+')) {
          // Added line - valid for comments
          validLines[filePath]?.add(currentLine);
          currentLine++;
        } else if (line.startsWith('-')) {
          // Deleted line - don't increment current line
          // Note: Comments on deleted lines use 'LEFT' side
          continue;
        } else if (line.startsWith(' ')) {
          // Context line - valid for comments
          validLines[filePath]?.add(currentLine);
          currentLine++;
        } else if (line.startsWith('\\')) {
          // "No newline at end of file" - ignore
          continue;
        } else {
          // End of hunk or other content
          inHunk = false;
        }
      }
    }

    return validLines;
  }
}
