# GitHub App Migration Guide for Augment Agent

This guide provides a comprehensive roadmap for converting the current Augment Agent GitHub Action into a GitHub App, enabling better security, scalability, and user experience.

## Overview

### Current Architecture (GitHub Action)
- **Trigger**: Manual workflow runs on PR events
- **Authentication**: User-provided `GITHUB_TOKEN` and `AUGMENT_SESSION_AUTH`
- **Installation**: Users copy workflow files to `.github/workflows/`
- **Execution**: Runs in GitHub Actions runners
- **Configuration**: Through workflow YAML files and repository secrets

### Target Architecture (GitHub App)
- **Trigger**: Automatic webhook events (PR opened, synchronized, etc.)
- **Authentication**: App installation tokens with granular permissions
- **Installation**: One-click installation from GitHub Marketplace
- **Execution**: Self-hosted server responding to webhooks
- **Configuration**: Web interface and repository-level settings

## Key Differences and Benefits

| Aspect | GitHub Action | GitHub App |
|--------|---------------|------------|
| **Installation** | Manual workflow setup | One-click marketplace install |
| **Authentication** | User tokens | App installation tokens |
| **Permissions** | Broad repository access | Granular, specific permissions |
| **Scalability** | Per-repository setup | Cross-repository, organization-wide |
| **User Experience** | Technical setup required | User-friendly installation |
| **Security** | User-managed secrets | App-managed authentication |
| **Billing** | Free (uses Actions minutes) | Can implement usage-based pricing |

## Required Changes

### 1. Infrastructure Changes

#### A. Web Server Implementation
Create a web server to handle GitHub webhooks and serve the app interface.

```typescript
// src/server/app.ts
import express from 'express';
import { createProbot } from 'probot';
import { augmentAgentApp } from './probot-app.js';

const app = express();
const probot = createProbot();

// Load the GitHub App
probot.load(augmentAgentApp);

// Webhook endpoint
app.use('/webhooks', probot.webhooks.middleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

export { app };
```

#### B. GitHub App Configuration
Replace the current GitHub Action setup with Probot-based GitHub App handling:

```typescript
// src/server/probot-app.ts
import { Probot } from 'probot';
import { AugmentAgentService } from '../services/augment-agent-service.js';

export const augmentAgentApp = (app: Probot) => {
  // Handle pull request events
  app.on(['pull_request.opened', 'pull_request.synchronize'], async (context) => {
    const { pull_request, repository } = context.payload;
    
    try {
      // Get installation-specific configuration
      const config = await getRepositoryConfig(context);
      
      // Initialize the Augment Agent service
      const agentService = new AugmentAgentService({
        installation: context.payload.installation,
        repository: repository.full_name,
        pullRequest: pull_request,
        config
      });
      
      // Process the pull request
      await agentService.processPullRequest();
      
    } catch (error) {
      context.log.error('Failed to process pull request', error);
    }
  });

  // Handle installation events
  app.on('installation.created', async (context) => {
    const { installation } = context.payload;
    context.log.info(`App installed for: ${installation.account.login}`);
    
    // Initialize default configuration for the installation
    await initializeInstallationConfig(context);
  });
};
```

### 2. Authentication Changes

#### A. Replace User Tokens with Installation Tokens

**Current (GitHub Action):**
```typescript
// Uses user-provided GITHUB_TOKEN
const octokit = new Octokit({ auth: config.token });
```

**New (GitHub App):**
```typescript
// Uses installation token with specific permissions
export class GitHubAppService {
  private app: App;
  
  constructor(appId: string, privateKey: string) {
    this.app = new App({
      appId,
      privateKey,
    });
  }
  
  async getInstallationOctokit(installationId: number) {
    return await this.app.getInstallationOctokit(installationId);
  }
}
```

#### B. Augment Authentication Management
Create a secure service for managing Augment API credentials:

```typescript
// src/services/credential-service.ts
export class CredentialService {
  private encryptionKey: string;
  
  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }
  
  async storeAugmentCredentials(installationId: number, credentials: AugmentCredentials) {
    const encrypted = encrypt(JSON.stringify(credentials), this.encryptionKey);
    await this.database.storeCredentials(installationId, encrypted);
  }
  
  async getAugmentCredentials(installationId: number): Promise<AugmentCredentials | null> {
    const encrypted = await this.database.getCredentials(installationId);
    if (!encrypted) return null;
    
    const decrypted = decrypt(encrypted, this.encryptionKey);
    return JSON.parse(decrypted);
  }
}
```

### 3. Configuration Management

#### A. Web-based Configuration Interface
Create a configuration interface for users to set up their preferences:

```typescript
// src/web/config-routes.ts
import express from 'express';

const router = express.Router();

// Configuration page for installations
router.get('/config/:installationId', async (req, res) => {
  const { installationId } = req.params;
  const config = await getInstallationConfig(installationId);
  
  res.render('config', {
    installationId,
    config,
    llmProviders: ['auggie', 'openai', 'claude', 'google']
  });
});

// Save configuration
router.post('/config/:installationId', async (req, res) => {
  const { installationId } = req.params;
  const config = req.body;
  
  await saveInstallationConfig(installationId, config);
  res.redirect(`/config/${installationId}?saved=true`);
});

export { router as configRoutes };
```

#### B. Repository-level Configuration
Support `.augment.yml` configuration files in repositories:

```yaml
# .augment.yml
version: 1
enabled: true
triggers:
  - pull_request.opened
  - pull_request.synchronize
llm:
  provider: auggie
  model: gpt-4
  temperature: 0.7
templates:
  default: "code-review"
  custom_templates_dir: ".augment/templates"
review:
  auto_comment: true
  request_changes: false
  approve_if_lgtm: false
```

### 4. Database and State Management

#### A. Database Schema
```sql
-- Installation configurations
CREATE TABLE installations (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER UNIQUE NOT NULL,
  account_login VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  installed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Repository configurations
CREATE TABLE repository_configs (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER REFERENCES installations(installation_id),
  repository_full_name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(installation_id, repository_full_name)
);

-- Encrypted credentials
CREATE TABLE encrypted_credentials (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER REFERENCES installations(installation_id),
  credential_type VARCHAR(50) NOT NULL,
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(installation_id, credential_type)
);

-- Processing logs
CREATE TABLE processing_logs (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER REFERENCES installations(installation_id),
  repository_full_name VARCHAR(255) NOT NULL,
  pull_request_number INTEGER,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Deployment Architecture

#### A. Container Setup
```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN npm install -g bun && bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "start"]
```

#### B. Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: augment-agent-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: augment-agent-app
  template:
    metadata:
      labels:
        app: augment-agent-app
    spec:
      containers:
      - name: app
        image: augmentcode/augment-agent-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: GITHUB_APP_ID
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: github-app-id
        - name: GITHUB_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: github-private-key
        - name: WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: webhook-secret
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: encryption-key
```

## Migration Steps

### Phase 1: Core Infrastructure (Week 1-2)

1. **Set up GitHub App Registration**
   - Register new GitHub App in GitHub Developer Settings
   - Configure webhook URL and permissions
   - Generate and securely store private key

2. **Create Basic Web Server**
   - Implement Express.js server with Probot integration
   - Set up webhook handling for pull request events
   - Add health check and basic monitoring endpoints

3. **Database Setup**
   - Set up PostgreSQL database with required schema
   - Implement database connection and basic ORM/query functions
   - Add encryption/decryption utilities for sensitive data

### Phase 2: Core Functionality (Week 3-4)

1. **Port Core Services**
   - Adapt existing `GitHubService` to use installation tokens
   - Modify LLM providers to work with app architecture
   - Update template processing for app context

2. **Implement Configuration Management**
   - Create web interface for installation configuration
   - Add support for repository-level `.augment.yml` files
   - Implement credential storage and retrieval

3. **Add Event Processing**
   - Process pull request opened/updated events
   - Implement async job processing for long-running tasks
   - Add comprehensive error handling and logging

### Phase 3: User Experience (Week 5-6)

1. **Configuration Interface**
   - Build responsive web UI for app configuration
   - Add authentication for app management
   - Implement installation setup wizard

2. **Repository Integration**
   - Support for `.augment.yml` configuration files
   - Template directory management
   - Custom instruction file support

3. **Monitoring and Analytics**
   - Add usage tracking and analytics
   - Implement performance monitoring
   - Create admin dashboard for app management

### Phase 4: Security and Compliance (Week 7-8)

1. **Security Hardening**
   - Implement proper secret management
   - Add rate limiting and abuse protection
   - Security audit and penetration testing

2. **Compliance and Documentation**
   - Create comprehensive user documentation
   - Implement GDPR/privacy compliance
   - Add terms of service and privacy policy

3. **Testing and Quality Assurance**
   - Comprehensive unit and integration tests
   - Load testing and performance optimization
   - User acceptance testing

## Required Permissions

The GitHub App will need the following permissions:

### Repository Permissions
- **Contents**: Read (to access repository files and configuration)
- **Pull requests**: Read & Write (to read PR details and post comments)
- **Issues**: Read & Write (if supporting issue analysis)
- **Metadata**: Read (to access repository metadata)

### Organization Permissions
- **Members**: Read (if providing organization-wide analytics)

### Subscription Events
- **Pull request**: opened, synchronize, closed
- **Installation**: created, deleted
- **Installation repositories**: added, removed

## Security Considerations

### 1. Credential Management
- **Encrypt all stored credentials** using industry-standard encryption
- **Rotate encryption keys** regularly
- **Use separate encryption keys** per environment
- **Implement credential expiration** and refresh mechanisms

### 2. Access Control
- **Validate webhook signatures** to ensure requests come from GitHub
- **Implement rate limiting** to prevent abuse
- **Log all access** for audit trails
- **Use principle of least privilege** for all permissions

### 3. Data Privacy
- **Minimize data collection** to only what's necessary
- **Implement data retention policies** with automatic cleanup
- **Provide data export/deletion** capabilities for users
- **Comply with GDPR and other privacy regulations**

## Cost Considerations

### Infrastructure Costs
- **Web servers**: $50-200/month depending on scale
- **Database**: $20-100/month for PostgreSQL hosting
- **CDN and load balancing**: $20-50/month
- **Monitoring and logging**: $30-100/month

### Development Costs
- **Initial development**: 6-8 weeks of development time
- **Ongoing maintenance**: 20-30% of initial development time annually
- **Security audits**: $5,000-15,000 annually

### Revenue Opportunities
- **Freemium model**: Free tier with basic features, paid tiers for advanced features
- **Usage-based pricing**: Charge per API call or processing minute
- **Enterprise licenses**: Custom pricing for large organizations

## Migration Timeline

| Phase | Duration | Key Deliverables | Success Criteria |
|-------|----------|------------------|------------------|
| **Phase 1** | 2 weeks | Core infrastructure | Server responds to webhooks |
| **Phase 2** | 2 weeks | Core functionality | Can process PRs and generate reviews |
| **Phase 3** | 2 weeks | User experience | Web interface functional |
| **Phase 4** | 2 weeks | Security & launch | Ready for production deployment |

**Total estimated timeline**: 8 weeks for MVP, additional 4-6 weeks for marketplace approval and launch.

## Success Metrics

### Technical Metrics
- **Response time**: < 2 seconds for webhook processing
- **Uptime**: > 99.9% availability
- **Error rate**: < 1% of requests fail
- **Scalability**: Handle 1000+ installations

### Business Metrics
- **Installation rate**: Track new installations per week
- **User engagement**: Active installations and usage patterns
- **Customer satisfaction**: NPS score > 50
- **Revenue**: If implementing paid features

## Next Steps

1. **Create GitHub App Registration** - Start with development app for testing
2. **Set up development environment** - Database, webhooks tunnel for local development
3. **Implement MVP version** - Basic webhook handling and PR processing
4. **Beta testing** - Deploy to staging and test with select repositories
5. **Production deployment** - Launch and submit to GitHub Marketplace

This migration represents a significant architectural shift but will provide much better user experience, security, and scalability compared to the current GitHub Action approach.