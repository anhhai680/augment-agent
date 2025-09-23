/**
 * Context builder - responsible for aggregating context from multiple sources
 */

import { logger } from '../utils/logger.js';
import { PRExtractor } from './extractors/pr-extractor.js';
import { CustomContextExtractor } from './extractors/custom-context-extractor.js';
import { AzureDevOpsContextExtractor } from './extractors/azure-devops-context-extractor.js';
import type { TemplateContext, AnyTemplateContext } from '../types/context.js';
import type { AzureDevOpsTemplateContext } from '../types/azure-devops-context.js';
import type { ActionInputs } from '../types/inputs.js';

export class ContextBuilder {
  constructor(
    private prExtractor: PRExtractor,
    private customContextExtractor: CustomContextExtractor,
    private azureDevOpsExtractor?: AzureDevOpsContextExtractor
  ) {}

  static create(inputs: ActionInputs): ContextBuilder {
    const prExtractor = PRExtractor.create(inputs);
    const customContextExtractor = CustomContextExtractor.create(inputs);

    // Create Azure DevOps extractor only if platform is explicitly set to azure-devops
    // and all required Azure DevOps configuration is present
    let azureDevOpsExtractor: AzureDevOpsContextExtractor | undefined;
    if (
      inputs.platform === 'azure-devops' &&
      inputs.azureDevOpsToken &&
      inputs.azureDevOpsOrganization &&
      inputs.azureDevOpsProject &&
      inputs.azureDevOpsRepository
    ) {
      try {
        azureDevOpsExtractor = new AzureDevOpsContextExtractor(inputs);
        logger.info('Azure DevOps context extractor created successfully');
      } catch (error) {
        logger.error('Failed to create Azure DevOps extractor, falling back to GitHub', error);
      }
    }

    return new ContextBuilder(prExtractor, customContextExtractor, azureDevOpsExtractor);
  }

  async buildContext(inputs: ActionInputs): Promise<AnyTemplateContext> {
    try {
      logger.debug('Building template context from inputs', {
        platform: inputs.platform || 'github',
        hasAzureDevOpsExtractor: !!this.azureDevOpsExtractor,
      });

      // Determine platform and build appropriate context
      // Only use Azure DevOps if explicitly set AND extractor is available
      if (inputs.platform === 'azure-devops' && this.azureDevOpsExtractor) {
        logger.info('Building Azure DevOps context');
        return await this.buildAzureDevOpsContext(inputs);
      } else {
        logger.info('Building GitHub context');
        return await this.buildGitHubContext(inputs);
      }
    } catch (error) {
      logger.error('Failed to build template context', error);
      throw error;
    }
  }

  private async buildGitHubContext(inputs: ActionInputs): Promise<TemplateContext> {
    const context: TemplateContext = {
      platform: 'github',
    };

    // Extract PR data (extractor decides if it should run)
    const prData = await this.prExtractor.extract(inputs);
    if (prData) {
      context.pr = prData;
      logger.debug('PR data extracted and added to context', {
        prNumber: prData.number,
        title: prData.title,
      });
    }

    // Extract custom context if available
    const customContext = await this.customContextExtractor.extract(inputs);
    if (customContext) {
      context.custom = customContext;
      logger.debug('Custom context extracted and added', {
        customContextKeys: Object.keys(customContext),
      });
    }

    logger.info('GitHub template context built successfully', {
      hasPR: !!context.pr,
      hasCustom: !!context.custom,
      customKeys: context.custom ? Object.keys(context.custom) : [],
    });

    return context;
  }

  private async buildAzureDevOpsContext(inputs: ActionInputs): Promise<AzureDevOpsTemplateContext> {
    if (!this.azureDevOpsExtractor) {
      throw new Error('Azure DevOps extractor not available');
    }

    const context: AzureDevOpsTemplateContext = {
      platform: 'azure-devops',
    };

    // Extract PR data
    const prData = await this.azureDevOpsExtractor.extractPRData(inputs);
    if (prData) {
      context.pr = prData;
      logger.debug('Azure DevOps PR data extracted and added to context', {
        pullRequestId: prData.pullRequestId,
        title: prData.title,
      });
    }

    // Extract work item data
    const workItemData = await this.azureDevOpsExtractor.extractWorkItemData(inputs);
    if (workItemData) {
      context.workItem = workItemData;
      logger.debug('Azure DevOps work item data extracted and added to context', {
        workItemId: workItemData.id,
        title: workItemData.title,
      });
    }

    // Extract build data
    const buildData = await this.azureDevOpsExtractor.extractBuildData(inputs);
    if (buildData) {
      context.build = buildData;
      logger.debug('Azure DevOps build data extracted and added to context', {
        buildId: buildData.id,
        buildNumber: buildData.buildNumber,
      });
    }

    // Extract custom context if available
    const customContext = await this.customContextExtractor.extract(inputs);
    if (customContext) {
      context.custom = customContext;
      logger.debug('Custom context extracted and added', {
        customContextKeys: Object.keys(customContext),
      });
    }

    logger.info('Azure DevOps template context built successfully', {
      hasPR: !!context.pr,
      hasWorkItem: !!context.workItem,
      hasBuild: !!context.build,
      hasCustom: !!context.custom,
      customKeys: context.custom ? Object.keys(context.custom) : [],
    });

    return context;
  }
}
