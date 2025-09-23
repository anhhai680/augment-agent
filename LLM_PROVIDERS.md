# LLM Providers Guide

The Augment Agent now supports multiple LLM providers, giving you flexibility to choose the best AI model for your needs. This guide covers all supported providers and how to configure them.

## Supported Providers

| Provider   | Models                   | API Key Format | Base URL                                           |
| ---------- | ------------------------ | -------------- | -------------------------------------------------- |
| **Auggie** | All Auggie models        | Session auth   | N/A                                                |
| **OpenAI** | GPT-4, GPT-3.5, etc.     | `sk-...`       | `https://api.openai.com/v1`                        |
| **Claude** | Claude-3, Claude-2, etc. | `sk-ant-...`   | `https://api.anthropic.com/v1`                     |
| **Google** | Gemini Pro, Gemini Flash | Long API key   | `https://generativelanguage.googleapis.com/v1beta` |

## Configuration

### Basic Usage

```yaml
- name: Code Review with Custom LLM
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'openai' # or "claude", "google", "auggie"
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    model: 'gpt-4'
    instruction: 'Review this code for security issues'
```

### Advanced Configuration

```yaml
- name: Advanced LLM Configuration
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'claude'
    llm_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    llm_base_url: 'https://api.anthropic.com/v1' # Optional custom endpoint
    model: 'claude-3-sonnet-20240229'
    llm_temperature: '0.2' # 0.0 to 2.0
    llm_max_tokens: '4000' # Maximum response length
    llm_timeout: '30000' # Timeout in milliseconds
    instruction: 'Analyze this code'
```

## Provider-Specific Configuration

### 1. Auggie (Default)

Auggie is the default provider and uses session authentication.

```yaml
- name: Auggie Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'auggie' # Optional, defaults to auggie
    augment_session_auth: ${{ secrets.AUGMENT_SESSION_AUTH }}
    model: 'sonnet4' # Any Auggie model
    instruction: 'Review this PR'
```

**Available Models:**

- `sonnet4` - Claude Sonnet 4
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo
- And more (use `auggie --list-models` to see all)

### 2. OpenAI

OpenAI provides access to GPT models with excellent code understanding.

```yaml
- name: OpenAI Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'openai'
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    model: 'gpt-4'
    llm_temperature: '0.3'
    instruction: 'Review this code'
```

**Available Models:**

- `gpt-4` - Most capable model
- `gpt-4-turbo` - Faster GPT-4 variant
- `gpt-3.5-turbo` - Cost-effective option
- `gpt-3.5-turbo-16k` - Longer context

**API Key Setup:**

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it as `OPENAI_API_KEY` secret in your repository

### 3. Claude (Anthropic)

Claude provides excellent reasoning and helpful responses.

```yaml
- name: Claude Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'claude'
    llm_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    model: 'claude-3-sonnet-20240229'
    llm_temperature: '0.2'
    instruction: 'Review this code'
```

**Available Models:**

- `claude-3-opus-20240229` - Most capable
- `claude-3-sonnet-20240229` - Balanced performance
- `claude-3-haiku-20240307` - Fastest and cheapest
- `claude-2.1` - Previous generation
- `claude-instant-1.2` - Instant responses

**API Key Setup:**

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add it as `ANTHROPIC_API_KEY` secret in your repository

### 4. Google (Gemini)

Google Gemini provides competitive performance with good value.

```yaml
- name: Google Gemini Review
  uses: augmentcode/augment-agent@v0
  with:
    llm_provider: 'google'
    llm_api_key: ${{ secrets.GOOGLE_API_KEY }}
    model: 'gemini-pro'
    llm_temperature: '0.4'
    instruction: 'Review this code'
```

**Available Models:**

- `gemini-pro` - Most capable model
- `gemini-pro-vision` - With image understanding
- `gemini-1.5-pro` - Latest generation
- `gemini-1.5-flash` - Faster variant

**API Key Setup:**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add it as `GOOGLE_API_KEY` secret in your repository

## Multi-Provider Comparison

You can run multiple LLM providers in parallel to compare their responses:

```yaml
name: Multi-LLM Comparison
on:
  pull_request:
    types: [opened]

jobs:
  multi-llm-review:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        llm_config:
          - { provider: 'openai', model: 'gpt-4', secret: 'OPENAI_API_KEY' }
          - {
              provider: 'claude',
              model: 'claude-3-sonnet-20240229',
              secret: 'ANTHROPIC_API_KEY',
            }
          - {
              provider: 'google',
              model: 'gemini-pro',
              secret: 'GOOGLE_API_KEY',
            }

    steps:
      - uses: actions/checkout@v4

      - name: ${{ matrix.llm_config.provider }} Review
        uses: augmentcode/augment-agent@v0
        with:
          llm_provider: ${{ matrix.llm_config.provider }}
          llm_api_key: ${{ secrets[matrix.llm_config.secret] }}
          model: ${{ matrix.llm_config.model }}
          instruction: 'Review this pull request'
```

## Performance Comparison

| Provider   | Speed    | Quality    | Cost       | Best For                             |
| ---------- | -------- | ---------- | ---------- | ------------------------------------ |
| **Auggie** | ⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | Existing users, integrated workflow  |
| **OpenAI** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | Code review, general tasks           |
| **Claude** | ⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | Complex reasoning, helpful responses |
| **Google** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | Cost-effective, good performance     |

## Error Handling

The agent includes comprehensive error handling for all providers:

- **Authentication errors**: Invalid or expired API keys
- **Rate limiting**: Automatic retry with exponential backoff
- **Network errors**: Timeout and connection error handling
- **Provider-specific errors**: Detailed error messages

## Security Best Practices

1. **Store API keys as secrets**: Never commit API keys to your repository
2. **Use minimal permissions**: Only grant necessary API access
3. **Monitor usage**: Set up billing alerts for API usage
4. **Rotate keys regularly**: Update API keys periodically
5. **Use environment-specific keys**: Different keys for different environments

## Troubleshooting

### Common Issues

1. **"Invalid API key format"**
   - Verify the API key format matches the provider requirements
   - Check that the secret is properly configured

2. **"Provider configuration validation failed"**
   - Ensure all required parameters are provided
   - Check API key permissions and quotas

3. **"LLM provider failed to generate response"**
   - Check API key validity and permissions
   - Verify network connectivity
   - Check provider service status

### Debug Mode

Enable debug logging to troubleshoot issues:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

This will provide detailed logs for LLM provider operations.

## Migration from Auggie

If you're currently using Auggie and want to try other providers:

1. **Keep existing workflows**: Auggie remains the default and continues to work
2. **Add new provider**: Create new workflows with different providers
3. **Compare results**: Use multi-provider comparison to evaluate options
4. **Gradual migration**: Switch providers gradually based on your needs

## Cost Optimization

- **Use appropriate models**: Choose models based on task complexity
- **Optimize temperature**: Lower values for consistent results, higher for creativity
- **Limit max tokens**: Set appropriate limits to control costs
- **Monitor usage**: Track API usage and costs across providers

## Support

For issues specific to LLM providers:

- **OpenAI**: [OpenAI Support](https://help.openai.com/)
- **Claude**: [Anthropic Support](https://support.anthropic.com/)
- **Google**: [Google AI Support](https://support.google.com/a/answer/10569497)
- **Auggie**: [Augment Support](https://docs.augmentcode.com/)

For general agent issues, please open an issue in the [augment-agent repository](https://github.com/augmentcode/augment-agent/issues).
