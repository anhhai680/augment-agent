# Auggie Agent GitHub Action

AI-powered code assistance for GitHub pull requests using Auggie.

## Quick Start

### 1. Get Your Augment API Credentials

First, you'll need to obtain your Augment Authentication information from your local Auggie session:

Example session JSON:

```json
{
  "accessToken": "your-api-token-here",
  "tenantURL": "https://your-tenant.api.augmentcode.com"
}
```

There are 2 ways to get the credentials:

- Run `auggie tokens print`
  - Copy the JSON after `TOKEN=`
- Copy the credentials stored in your Augment cache directory, defaulting to `~/.augment/session.json`

> **⚠️ Security Warning**: These tokens are OAuth tokens tied to your personal Augment account and provide access to your Augment services. They are not tied to a team or enterprise. Treat them as sensitive credentials:
>
> - Never commit them to version control
> - Only store them in secure locations (like GitHub secrets)
> - Don't share them in plain text or expose them in logs
> - If a token is compromised, immediately revoke it using `auggie tokens revoke`

### 2. Set Up the GitHub Repository Secret

You need to add your Augment credentials to your GitHub repository:

#### Adding Secret

1. **Navigate to your repository** on GitHub
2. **Go to Settings** → **Secrets and variables** → **Actions**
3. **Add the following**:
   - **Secret**: Click "New repository secret"
     - Name: `AUGMENT_SESSION_AUTH`
     - Value: The json value from step 1

> **Need more help?** For detailed instructions on managing GitHub secrets, see GitHub's official documentation:
>
> - [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)

### 3. Create Your Workflow File

Add a new workflow file to your repository's `.github/workflows/` directory and merge it.

#### Example Workflows

For complete workflow examples, see the [`example-workflows/`](./example-workflows/) directory which contains:

- **PR Description Generation** - Automatically generate comprehensive PR descriptions
- **Code Review** - Perform automated code quality and security reviews
- **Issue Triage** - Automatically analyze and triage GitHub issues with priority and categorization recommendations
- **Template-Based Review** - Demonstrates the template system for dynamic, context-aware instructions

Each example includes a complete workflow file that you can copy to your `.github/workflows/` directory and customize for your needs.

## Azure DevOps Integration

The Augment Agent now supports Azure DevOps in addition to GitHub! You can use the agent to analyze Azure DevOps pull requests, work items, and build information.

### Azure DevOps Setup

1. **Create Azure DevOps Personal Access Token (PAT)**:
   - Go to Azure DevOps → User Settings → Personal Access Tokens
   - Create a new token with the following scopes:
     - `Code (read)` - for pull request access
     - `Work Items (read)` - for work item access
     - `Build (read)` - for build information access

2. **Configure GitHub Secrets**:
   - Add your Azure DevOps PAT as `AZURE_DEVOPS_TOKEN`
   - Add your organization name as `AZURE_DEVOPS_ORGANIZATION`
   - Add your project name as `AZURE_DEVOPS_PROJECT`
   - Add your repository name as `AZURE_DEVOPS_REPOSITORY`

### Azure DevOps Example Workflows

The [`example-workflows/`](./example-workflows/) directory includes Azure DevOps specific examples:

- **Azure DevOps PR Review** - Review Azure DevOps pull requests
- **Azure DevOps Template-Based Review** - Use templates with Azure DevOps context
- **Azure DevOps Work Item Analysis** - Analyze work items and requirements

### Azure DevOps Template Context

When using `platform: "azure-devops"`, templates have access to Azure DevOps specific context:

```nunjucks
{# Azure DevOps PR context #}
{{ pr.pullRequestId }}           {# PR ID #}
{{ pr.title }}                   {# PR title #}
{{ pr.description }}             {# PR description #}
{{ pr.author }}                  {# PR author #}
{{ pr.sourceRef.ref }}           {# Source branch #}
{{ pr.targetRef.ref }}           {# Target branch #}
{{ pr.sourceRef.repo.organization }}  {# Organization #}
{{ pr.sourceRef.repo.project }}      {# Project #}
{{ pr.sourceRef.repo.repository }}   {# Repository #}

{# Work Item context #}
{{ workItem.id }}                {# Work Item ID #}
{{ workItem.title }}             {# Work Item title #}
{{ workItem.workItemType }}      {# Work Item type #}
{{ workItem.state }}             {# Work Item state #}
{{ workItem.assignedTo }}        {# Assigned to #}
{{ workItem.priority }}          {# Priority #}
{{ workItem.severity }}          {# Severity #}

{# Build context #}
{{ build.id }}                   {# Build ID #}
{{ build.buildNumber }}          {# Build number #}
{{ build.status }}               {# Build status #}
{{ build.result }}               {# Build result #}
{{ build.sourceBranch }}         {# Source branch #}
```

## Advanced

### Inputs

| Input                          | Description                                              | Required | Example                                     |
| ------------------------------ | -------------------------------------------------------- | -------- | ------------------------------------------- |
| `augment_session_auth`         | Augment session authentication JSON (store as secret)    | No\*\*   | `${{ secrets.AUGMENT_SESSION_AUTH }}`       |
| `augment_api_token`            | API token for Augment services (store as secret)         | No\*\*   | `${{ secrets.AUGMENT_API_TOKEN }}`          |
| `augment_api_url`              | Augment API endpoint URL (store as variable)             | No\*\*   | `${{ vars.AUGMENT_API_URL }}`               |
| `github_token`                 | GitHub token with `repo` and `user:email` scopes.        | No       | `${{ secrets.GITHUB_TOKEN }}`               |
| `instruction`                  | Direct instruction text for simple commands              | No\*     | `"Generate PR description"`                 |
| `instruction_file`             | Path to file with detailed instructions                  | No\*     | `/tmp/instruction.txt`                      |
| `template_directory`           | Path to template directory for dynamic instructions      | No\*     | `.github/templates`                         |
| `template_name`                | Template file name (default: prompt.njk)                 | No       | `pr-review.njk`                             |
| `pull_number`                  | PR number for template context extraction                | No       | `${{ github.event.pull_request.number }}`   |
| `repo_name`                    | Repository name for template context                     | No       | `${{ github.repository }}`                  |
| `custom_context`               | Additional JSON context for templates                    | No       | `'{"priority": "high"}'`                    |
| `model`                        | Model to use; passed through to auggie as --model        | No       | e.g. `sonnet4`, from `auggie --list-models` |
| `platform`                     | Platform for context extraction (github or azure-devops) | No       | `"azure-devops"`                            |
| `azure_devops_token`           | Azure DevOps Personal Access Token (store as secret)     | No       | `${{ secrets.AZURE_DEVOPS_TOKEN }}`         |
| `azure_devops_organization`    | Azure DevOps organization name                           | No       | `"my-organization"`                         |
| `azure_devops_project`         | Azure DevOps project name                                | No       | `"my-project"`                              |
| `azure_devops_repository`      | Azure DevOps repository name                             | No       | `"my-repository"`                           |
| `azure_devops_pull_request_id` | Azure DevOps pull request ID (not GitHub PR number)      | No       | `123`                                       |
| `azure_devops_work_item_id`    | Azure DevOps work item ID for context extraction         | No       | `456`                                       |
| `azure_devops_build_id`        | Azure DevOps build ID for context extraction             | No       | `789`                                       |
| `llm_provider`                 | LLM provider to use (auggie, openai, claude, google)     | No       | `"auggie"`                                  |
| `llm_api_key`                  | API key for the selected LLM provider (store as secret)  | No       | `${{ secrets.OPENAI_API_KEY }}`             |
| `llm_base_url`                 | Base URL for the LLM provider API (for custom endpoints) | No       | `"https://api.openai.com/v1"`               |
| `llm_temperature`              | Temperature setting for LLM generation (0.0 to 2.0)      | No       | `"0.7"`                                     |
| `llm_max_tokens`               | Maximum tokens for LLM response                          | No       | `"4000"`                                    |
| `llm_timeout`                  | Timeout for LLM API requests in milliseconds             | No       | `"30000"`                                   |

\*Either `instruction`, `instruction_file`, or `template_directory` must be provided.

\*\*Either `augment_session_auth` OR both `augment_api_token` and `augment_api_url` must be provided for authentication.

\*\*\*For non-Auggie providers, `llm_api_key` is required.

### Template System

For advanced use cases, the Auggie Agent supports a template system that automatically extracts context from GitHub pull requests and allows you to create dynamic, reusable instruction templates. Templates are ideal when you need instructions that adapt based on PR content, file changes, or custom data.

See [TEMPLATE.md](./TEMPLATE.md) for complete documentation on creating and using templates.

## LLM Providers

The Augment Agent supports multiple LLM providers, giving you flexibility to choose the best AI model for your needs:

### Supported Providers

- **Auggie** (default) - Uses Auggie service with session authentication
- **OpenAI** - GPT-4, GPT-3.5, and other OpenAI models
- **Claude** - Claude-3, Claude-2, and other Anthropic models
- **Google** - Gemini Pro, Gemini Flash, and other Google models

### Quick Start with Different Providers

**OpenAI:**

```yaml
- name: OpenAI Code Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'openai'
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    model: 'gpt-4'
    instruction: 'Review this code for security issues'
```

**Claude:**

```yaml
- name: Claude Code Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'claude'
    llm_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: 'claude-3-sonnet-20240229'
    instruction: 'Review this code for security issues'
```

**Google:**

```yaml
- name: Google Gemini Code Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'google'
    llm_api_key: ${{ secrets.GOOGLE_API_KEY }}
    model: 'gemini-pro'
    instruction: 'Review this code for security issues'
```

### Example Workflows

The [`example-workflows/`](./example-workflows/) directory includes LLM provider specific examples:

- **OpenAI Code Review** - Review code using OpenAI GPT-4
- **Claude Code Review** - Review code using Claude Sonnet
- **Google Code Review** - Review code using Google Gemini
- **Multi-LLM Comparison** - Compare responses from multiple providers

### Provider Configuration

Each provider supports advanced configuration:

```yaml
- name: Advanced LLM Configuration
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'openai'
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    llm_base_url: 'https://api.openai.com/v1' # Optional custom endpoint
    model: 'gpt-4'
    llm_temperature: '0.3' # 0.0 to 2.0
    llm_max_tokens: '4000' # Maximum response length
    llm_timeout: '30000' # Timeout in milliseconds
    instruction: 'Analyze this code'
```

See [LLM_PROVIDERS.md](./LLM_PROVIDERS.md) for complete documentation on all LLM providers, including setup instructions, model options, and best practices.
