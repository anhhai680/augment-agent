/**
 * Review parser service - parses LLM output to extract structured review comments
 */

import { logger } from '../utils/logger.js';
import type { StructuredReview, ParsedReview, GitHubReviewComment } from '../types/review.js';

export class ReviewParser {
  /**
   * Attempts to parse LLM output as structured JSON review
   */
  static parseStructuredReview(content: string): StructuredReview | null {
    try {
      logger.debug('Attempting to parse structured JSON review');
      
      // Try to find JSON in the content
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n\s*```/);
      let jsonString = jsonMatch ? jsonMatch[1] : content;

      if (jsonMatch) {
        logger.debug('Found JSON within code fences');
      } else {
        logger.debug('No code fences found, trying to parse entire content as JSON');
      }

      // Try to find JSON block without code fences
      if (!jsonMatch) {
        const jsonBlockMatch = content.match(/\{[\s\S]*\}/);
        if (jsonBlockMatch) {
          jsonString = jsonBlockMatch[0];
          logger.debug('Found JSON block without code fences');
        }
      }

      if (!jsonString) {
        logger.debug('No JSON content found');
        return null;
      }

      logger.debug('Attempting to parse JSON string', { 
        jsonLength: jsonString.length,
        jsonPreview: jsonString.substring(0, 100) + '...'
      });

      const parsed = JSON.parse(jsonString);
      
      // Validate the structure - handle both nested and flat formats
      if (parsed && typeof parsed === 'object' && typeof parsed.summary === 'string') {
        
        // Check if it's the nested format with files
        if (parsed.files && typeof parsed.files === 'object') {
          logger.info('Successfully validated structured review format (nested)');
          logger.debug('Parsed review structure:', {
            summary: parsed.summary,
            fileCount: Object.keys(parsed.files).length,
            files: Object.keys(parsed.files)
          });
          return parsed as StructuredReview;
        }
        
        // Check if it's the flat format with line_comments array
        if (parsed.line_comments && Array.isArray(parsed.line_comments)) {
          logger.info('Successfully validated structured review format (flat) - converting to nested');
          
          // Convert flat format to nested format
          const nestedFormat: StructuredReview = {
            summary: parsed.summary,
            files: {}
          };
          
          // Group line comments by file
          for (const comment of parsed.line_comments) {
            if (comment.file && comment.line && comment.comment) {
              const filePath = comment.file;
              
              if (!nestedFormat.files[filePath]) {
                nestedFormat.files[filePath] = {
                  line_comments: [],
                  general_comments: []
                };
              }
              
              nestedFormat.files[filePath].line_comments.push({
                line: comment.line,
                comment: comment.comment,
                side: comment.side || 'RIGHT'
              });
            }
          }
          
          logger.debug('Converted flat format to nested:', {
            fileCount: Object.keys(nestedFormat.files).length,
            files: Object.keys(nestedFormat.files)
          });
          
          return nestedFormat;
        }
      }
      
      logger.debug('JSON parsed but structure validation failed');
      return null;
    } catch (error) {
      logger.debug('Failed to parse as structured JSON review', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Parses markdown-style review content to extract file-specific comments
   */
  static parseMarkdownReview(content: string): ParsedReview {
    const comments: GitHubReviewComment[] = [];
    let summary = '';

    // Split content into sections
    const sections = content.split(/(?=^##?\s)/m);
    
    for (const section of sections) {
      const lines = section.split('\n');
      const header = lines[0]?.trim();
      
      if (!header) continue;

      // Check if this is a file-specific section
      const fileMatch = header.match(/^##?\s*(?:File:?\s*)?([^\s]+\.(ts|js|tsx|jsx|py|java|c|cpp|cs|go|rb|php|swift|kt|rs|dart|scala|clj|elm|hs|ml|fs|vb|pas|asm|sh|bat|ps1|yaml|yml|json|xml|html|css|scss|sass|less|md|txt|sql|r|mat|ipynb|vue|svelte|astro)(?:\s|$))/i);
      
      if (fileMatch && fileMatch[1]) {
        const filePath: string = fileMatch[1];
        const fileContentLines = lines.slice(1).filter((line): line is string => typeof line === 'string');
        const fileContent: string = fileContentLines.join('\n');
        
        if (fileContent.trim().length > 0) {
          // Look for line-specific comments in the format "Line X:" or "Lines X-Y:"
          const lineComments = ReviewParser.extractLineComments(fileContent, filePath);
          comments.push(...lineComments);
          
          // Look for general file comments (content that doesn't match line patterns)
          const generalComment = ReviewParser.extractGeneralFileComment(fileContent, filePath);
          if (generalComment) {
            comments.push(generalComment);
          }
        }
      } else {
        // This is likely the summary or general review content
        const content = lines.slice(1).join('\n').trim();
        if (content && !summary) {
          summary = section.trim();
        }
      }
    }

    // If no summary was found, use the first part of the content
    if (!summary) {
      const firstParagraph = content.split('\n\n')[0];
      if (firstParagraph && firstParagraph.length > 0) {
        summary = firstParagraph.trim();
      }
    }

    return {
      summary: summary || 'Code review completed',
      comments,
      hasInlineComments: comments.length > 0
    };
  }

  /**
   * Extracts line-specific comments from file content
   */
  private static extractLineComments(content: string, filePath: string): GitHubReviewComment[] {
    const comments: GitHubReviewComment[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line) continue;
      
      // Match patterns like "Line 42:", "Lines 42-45:", "L42:", etc.
      const lineMatch = line.match(/^(?:Lines?\s*|L)(\d+)(?:-(\d+))?:\s*(.+)/i);
      
      if (lineMatch && lineMatch[1] && lineMatch[3]) {
        const startLine = parseInt(lineMatch[1], 10);
        const endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : undefined;
        let comment = lineMatch[3];
        
        // Include following lines that are part of the comment (not starting with Line/L pattern)
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          if (!nextLine || nextLine.match(/^(?:Lines?\s*|L)\d+/i) || nextLine.match(/^##?\s/)) {
            break;
          }
          if (nextLine.trim()) {
            comment += '\n' + nextLine;
          }
          j++;
        }
        
        const reviewComment: GitHubReviewComment = {
          path: filePath,
          body: comment.trim(),
          line: endLine || startLine,
          side: 'RIGHT'
        };
        
        if (endLine) {
          reviewComment.start_line = startLine;
        }
        
        comments.push(reviewComment);
        
        i = j - 1; // Skip the lines we've processed
      }
    }

    return comments;
  }

  /**
   * Extracts general file comment (content not matching line patterns)
   */
  private static extractGeneralFileComment(content: string, filePath: string): GitHubReviewComment | null {
    const lines = content.split('\n');
    const generalLines: string[] = [];

    for (const line of lines) {
      // Skip line-specific comments and empty lines
      if (!line.match(/^(?:Lines?\s*|L)\d+/i) && line.trim()) {
        generalLines.push(line);
      }
    }

    const generalContent = generalLines.join('\n').trim();
    
    if (generalContent && generalContent.length > 10) {
      return {
        path: filePath,
        body: `**General feedback for this file:**\n\n${generalContent}`,
        // For general file comments, we'll comment on line 1 as a file-level comment
        line: 1,
        side: 'RIGHT'
      };
    }

    return null;
  }

  /**
   * Main parsing function that tries structured first, then falls back to markdown
   */
  static parseReview(content: string): ParsedReview {
    logger.info('Starting review parsing process');
    logger.debug('Review content preview:', { 
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + '...' 
    });

    // First try to parse as structured JSON
    const structured = this.parseStructuredReview(content);
    
    if (structured) {
      logger.info('Successfully parsed structured JSON review');
      const parsed = this.convertStructuredToParsed(structured);
      logger.info(`Converted to ${parsed.comments.length} inline comments`);
      return parsed;
    }

    logger.info('JSON parsing failed, trying markdown parsing');
    // Fall back to markdown parsing
    const markdownParsed = this.parseMarkdownReview(content);
    logger.info(`Markdown parsing found ${markdownParsed.comments.length} comments`);
    return markdownParsed;
  }

  /**
   * Converts structured review format to parsed review format
   */
  private static convertStructuredToParsed(structured: StructuredReview): ParsedReview {
    const comments: GitHubReviewComment[] = [];

    logger.debug('Converting structured review to parsed format');
    
    for (const [filePath, fileReview] of Object.entries(structured.files)) {
      logger.debug(`Processing file: ${filePath}`, {
        lineComments: fileReview.line_comments.length,
        generalComments: fileReview.general_comments.length
      });

      // Add line-specific comments
      for (const lineComment of fileReview.line_comments) {
        const reviewComment: GitHubReviewComment = {
          path: filePath,
          body: lineComment.comment,
          line: lineComment.line,
          side: lineComment.side || 'RIGHT'
        };
        
        if (lineComment.startLine !== undefined) {
          reviewComment.start_line = lineComment.startLine;
        }
        
        comments.push(reviewComment);
      }

      // Add general file comments
      if (fileReview.general_comments && fileReview.general_comments.length > 0) {
        const generalComment = fileReview.general_comments.join('\n\n');
        comments.push({
          path: filePath,
          body: `**General feedback for this file:**\n\n${generalComment}`,
          line: 1,
          side: 'RIGHT'
        });
      }
    }

    logger.debug(`Converted ${comments.length} total comments from structured format`);

    return {
      summary: structured.summary,
      comments,
      hasInlineComments: comments.length > 0
    };
  }
}