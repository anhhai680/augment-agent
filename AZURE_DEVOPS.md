# Azure DevOps Integration Guide

This guide explains how to use the Augment Agent with Azure DevOps pipelines while maintaining full GitHub Actions compatibility.

## Overview

The Augment Agent now supports both GitHub and Azure DevOps platforms. You can use the same agent to:

- Review Azure DevOps pull requests
- Analyze Azure DevOps work items
- Extract build information from Azure DevOps pipelines
- Use templates with Azure DevOps context

## Setup

### 1. Azure DevOps Personal Access Token (PAT)

Create a PAT with the following scopes:

- `Code (read)` - Access to repositories and pull requests
- `Work Items (read)` - Access to work items
- `Build (read)` - Access to build information

### 2. GitHub Repository Configuration

Configure the following secrets and variables in your GitHub repository:

**Secrets** (sensitive data):

| Secret Name          | Description           | Example     |
| -------------------- | --------------------- | ----------- |
| `AZURE_DEVOPS_TOKEN` | Your Azure DevOps PAT | `abc123...` |

**Repository Variables** (non-sensitive configuration):

| Variable Name               | Description                    | Example      |
| --------------------------- | ------------------------------ | ------------ |
| `AZURE_DEVOPS_ORGANIZATION` | Azure DevOps organization name | `my-org`     |
| `AZURE_DEVOPS_PROJECT`      | Azure DevOps project name      | `my-project` |
| `AZURE_DEVOPS_REPOSITORY`   | Azure DevOps repository name   | `my-repo`    |

## Usage Examples

### Basic Azure DevOps PR Review

```yaml
name: Azure DevOps PR Review
on:
  pull_request:
    types: [opened]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Review Azure DevOps PR
        uses: augmentcode/augment-agent@v0
        with:
          augment_session_auth: ${{ secrets.AUGMENT_SESSION_AUTH }}
          platform: 'azure-devops'
          azure_devops_token: ${{ secrets.AZURE_DEVOPS_TOKEN }}
          azure_devops_organization: ${{ vars.AZURE_DEVOPS_ORGANIZATION }}
          azure_devops_project: ${{ vars.AZURE_DEVOPS_PROJECT }}
          azure_devops_repository: ${{ vars.AZURE_DEVOPS_REPOSITORY }}
          azure_devops_pull_request_id: ${{ github.event.pull_request.number }}
          instruction: 'Review this Azure DevOps pull request for code quality and security issues'
```

### Template-Based Azure DevOps Review

```yaml
name: Azure DevOps Template Review
on:
  pull_request:
    types: [opened]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create Azure DevOps template
        run: |
          mkdir -p .github/templates
          cat > .github/templates/azure-devops-review.njk << 'EOF'
          Review Azure DevOps PR #{{ pr.pullRequestId }}: "{{ pr.title }}"

          **Organization:** {{ pr.sourceRef.repo.organization }}
          **Project:** {{ pr.sourceRef.repo.project }}
          **Repository:** {{ pr.sourceRef.repo.repository }}
          **Author:** {{ pr.author }}
          **Branch:** {{ pr.sourceRef.ref }} → {{ pr.targetRef.ref }}

          **Changed Files:**
          {% for file in pr.changed_files_list %}
          - {{ file.path }}
          {% endfor %}

          **Code Changes:**
          {{ pr.diff_file | maybe_read_file }}

          Please provide a comprehensive review focusing on:
          - Code quality and best practices
          - Security considerations
          - Azure DevOps integration best practices
          EOF

      - name: Azure DevOps Template Review
        uses: augmentcode/augment-agent@v0
        with:
          augment_session_auth: ${{ secrets.AUGMENT_SESSION_AUTH }}
          platform: 'azure-devops'
          azure_devops_token: ${{ secrets.AZURE_DEVOPS_TOKEN }}
          azure_devops_organization: ${{ vars.AZURE_DEVOPS_ORGANIZATION }}
          azure_devops_project: ${{ vars.AZURE_DEVOPS_PROJECT }}
          azure_devops_repository: ${{ vars.AZURE_DEVOPS_REPOSITORY }}
          azure_devops_pull_request_id: ${{ github.event.pull_request.number }}
          template_directory: '.github/templates'
          template_name: 'azure-devops-review.njk'
```

### Work Item Analysis

```yaml
name: Azure DevOps Work Item Analysis
on:
  workflow_dispatch:
    inputs:
      work_item_id:
        description: 'Work Item ID'
        required: true
        type: string

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Analyze Work Item
        uses: augmentcode/augment-agent@v0
        with:
          augment_session_auth: ${{ secrets.AUGMENT_SESSION_AUTH }}
          platform: 'azure-devops'
          azure_devops_token: ${{ secrets.AZURE_DEVOPS_TOKEN }}
          azure_devops_organization: ${{ vars.AZURE_DEVOPS_ORGANIZATION }}
          azure_devops_project: ${{ vars.AZURE_DEVOPS_PROJECT }}
          azure_devops_work_item_id: ${{ github.event.inputs.work_item_id }}
          instruction: 'Analyze this work item and provide requirements breakdown, technical impact assessment, and implementation recommendations'
```

## Template Context Variables

When using `platform: "azure-devops"`, your templates have access to Azure DevOps specific context:

### Pull Request Context (`pr`)

```nunjucks
{{ pr.pullRequestId }}                    {# Pull Request ID #}
{{ pr.codeReviewId }}                    {# Code Review ID #}
{{ pr.title }}                           {# PR title #}
{{ pr.description }}                     {# PR description #}
{{ pr.author }}                          {# PR author #}
{{ pr.status }}                          {# PR status #}
{{ pr.sourceRef.ref }}                   {# Source branch #}
{{ pr.targetRef.ref }}                   {# Target branch #}
{{ pr.sourceRef.repo.organization }}     {# Organization #}
{{ pr.sourceRef.repo.project }}          {# Project #}
{{ pr.sourceRef.repo.repository }}        {# Repository #}
{{ pr.creationDate }}                    {# Creation date #}
{{ pr.changed_files }}                   {# Changed files (newline-separated) #}
{{ pr.changed_files_list }}              {# Array of changed files #}
{{ pr.diff_file }}                       {# Path to diff file #}
{{ pr.reviewers }}                       {# Array of reviewers #}
```

### Work Item Context (`workItem`)

```nunjucks
{{ workItem.id }}                        {# Work Item ID #}
{{ workItem.title }}                     {# Work Item title #}
{{ workItem.description }}               {# Work Item description #}
{{ workItem.workItemType }}               {# Work Item type #}
{{ workItem.state }}                     {# Work Item state #}
{{ workItem.assignedTo }}                {# Assigned to #}
{{ workItem.createdBy }}                 {# Created by #}
{{ workItem.createdDate }}               {# Creation date #}
{{ workItem.changedBy }}                 {# Changed by #}
{{ workItem.changedDate }}               {# Last changed date #}
{{ workItem.teamProject }}               {# Team project #}
{{ workItem.areaPath }}                  {# Area path #}
{{ workItem.iterationPath }}             {# Iteration path #}
{{ workItem.priority }}                  {# Priority #}
{{ workItem.severity }}                  {# Severity #}
{{ workItem.tags }}                      {# Tags #}
```

### Build Context (`build`)

```nunjucks
{{ build.id }}                           {# Build ID #}
{{ build.buildNumber }}                  {# Build number #}
{{ build.status }}                       {# Build status #}
{{ build.result }}                       {# Build result #}
{{ build.queueTime }}                    {# Queue time #}
{{ build.startTime }}                    {# Start time #}
{{ build.finishTime }}                   {# Finish time #}
{{ build.sourceBranch }}                 {# Source branch #}
{{ build.sourceVersion }}                {# Source version #}
{{ build.requestedBy }}                  {# Requested by #}
{{ build.requestedFor }}                 {# Requested for #}
{{ build.definition.id }}                {# Definition ID #}
{{ build.definition.name }}              {# Definition name #}
{{ build.definition.type }}              {# Definition type #}
{{ build.project.id }}                   {# Project ID #}
{{ build.project.name }}                 {# Project name #}
```

## Platform Detection

The agent automatically detects the platform based on the `platform` input:

- `platform: "github"` (default) - Uses GitHub API and context
- `platform: "azure-devops"` - Uses Azure DevOps API and context

If no platform is specified, it defaults to GitHub for backward compatibility.

## Error Handling

The agent includes comprehensive error handling for Azure DevOps:

- **Authentication errors**: Invalid or expired PAT
- **Permission errors**: Insufficient scopes on PAT
- **API errors**: Azure DevOps API unavailable or rate limited
- **Configuration errors**: Missing required Azure DevOps parameters

## Best Practices

1. **Security**: Always store Azure DevOps PATs as GitHub secrets
2. **Scopes**: Use minimal required scopes for your PAT
3. **Rate Limits**: Be aware of Azure DevOps API rate limits
4. **Templates**: Use templates for consistent Azure DevOps reviews
5. **Error Handling**: Include error handling in your workflows
6. **Testing**: Test your workflows with different Azure DevOps scenarios

## Troubleshooting

### Common Issues

1. **"Azure DevOps configuration is incomplete"**
   - Ensure all required Azure DevOps parameters are provided
   - Check that secrets are properly configured

2. **"Azure DevOps API request failed"**
   - Verify PAT is valid and has required scopes
   - Check organization, project, and repository names
   - Ensure PAT hasn't expired

3. **"Template not found"**
   - Verify template directory and file name are correct
   - Check file permissions

4. **"No Azure DevOps context extracted"**
   - Ensure pull request ID, work item ID, or build ID is provided
   - Verify the ID exists in Azure DevOps

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` environment variable:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

This will provide detailed logs for troubleshooting Azure DevOps integration issues.
