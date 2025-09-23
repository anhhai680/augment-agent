/**
 * Utility functions for working with template contexts
 */

import type { AnyTemplateContext, TemplateContext } from '../types/context.js';
import type { AzureDevOpsTemplateContext } from '../types/azure-devops-context.js';

/**
 * Type guard to check if a context is a GitHub template context
 */
export function isGitHubTemplateContext(context: AnyTemplateContext): context is TemplateContext {
  return context.platform === 'github';
}

/**
 * Type guard to check if a context is an Azure DevOps template context
 */
export function isAzureDevOpsTemplateContext(
  context: AnyTemplateContext
): context is AzureDevOpsTemplateContext {
  return context.platform === 'azure-devops';
}

/**
 * Safely access GitHub-specific context properties
 */
export function getGitHubContext(context: AnyTemplateContext): TemplateContext | null {
  return isGitHubTemplateContext(context) ? context : null;
}

/**
 * Safely access Azure DevOps-specific context properties
 */
export function getAzureDevOpsContext(
  context: AnyTemplateContext
): AzureDevOpsTemplateContext | null {
  return isAzureDevOpsTemplateContext(context) ? context : null;
}

/**
 * Get platform-specific PR data with proper type narrowing
 */
export function getPRData(context: AnyTemplateContext) {
  if (isGitHubTemplateContext(context)) {
    return context.pr; // Type: PRData | undefined
  } else if (isAzureDevOpsTemplateContext(context)) {
    return context.pr; // Type: AzureDevOpsPRData | undefined
  }
  return undefined;
}

/**
 * Get custom context data (available on both platforms)
 */
export function getCustomContext(context: AnyTemplateContext): Record<string, any> | undefined {
  return context.custom;
}

/**
 * Get platform-specific unique identifier for PR/context
 */
export function getPRIdentifier(context: AnyTemplateContext): string | number | undefined {
  if (isGitHubTemplateContext(context)) {
    return context.pr?.number;
  } else if (isAzureDevOpsTemplateContext(context)) {
    return context.pr?.pullRequestId;
  }
  return undefined;
}

/**
 * Get work item data (Azure DevOps only)
 * Returns null for GitHub contexts
 */
export function getWorkItemData(context: AnyTemplateContext) {
  return isAzureDevOpsTemplateContext(context) ? context.workItem : null;
}

/**
 * Get build data (Azure DevOps only)
 * Returns null for GitHub contexts
 */
export function getBuildData(context: AnyTemplateContext) {
  return isAzureDevOpsTemplateContext(context) ? context.build : null;
}
