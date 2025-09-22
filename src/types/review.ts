/**
 * Types for structured review comments and inline feedback
 */

export interface LineComment {
  line: number;
  comment: string;
  startLine?: number; // For multi-line comments
  side?: 'LEFT' | 'RIGHT'; // Side of diff (LEFT for deletions, RIGHT for additions)
}

export interface FileReview {
  line_comments: LineComment[];
  general_comments: string[];
}

export interface StructuredReview {
  summary: string;
  files: Record<string, FileReview>;
}

export interface GitHubReviewComment {
  path: string;
  body: string;
  line?: number;
  side?: 'LEFT' | 'RIGHT';
  start_line?: number;
  start_side?: 'LEFT' | 'RIGHT';
}

export interface ParsedReview {
  summary: string;
  comments: GitHubReviewComment[];
  hasInlineComments: boolean;
}