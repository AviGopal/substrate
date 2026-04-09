# Getting Your API Key

To run the MiniBob CI/CD demo, you need API keys for both Anthropic and Metabob.

## Anthropic API Key

Get your Anthropic API key from:
- https://console.anthropic.com/settings/keys

Export it:
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

## Metabob API Key (Activity Backend)

You have several options to get a Metabob API key:

### Option 1: Use Existing Organization (Recommended)

If you already have a Metabob account:

1. **Login to Metabob Dashboard**:
   ```bash
   # Visit https://app.metabob.com
   # Login with your credentials
   ```

2. **Create API Key**:
   - Go to Settings → API Keys
   - Click "Create New Key"
   - Name it: "MiniBob CI/CD Demo"
   - Copy the key (starts with `mb_live_` or `mb_svc_`)

3. **Export**:
   ```bash
   export METABOB_API_KEY="mb_live_your_key_here"
   ```

### Option 2: Create New Organization (Advanced)

If you have access to the canary SurrealDB (requires kubectl):

1. **Port-forward to SurrealDB**:
   ```bash
   kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
   ```

2. **Run commission script**:
   ```bash
   # In a new terminal
   cd /home/avi/documents/work/exp-repo/metabob-devbob

   bun run scripts/commission-canary.ts org create \
     --name "MiniBob CI/CD Demo" \
     --admin-email "demo@minibob.dev" \
     --tier "pro"
   ```

3. **Save credentials**:
   The script will output:
   - Organization ID
   - Admin credentials
   - MiniBob API Key

   **Save these immediately!** They won't be shown again.

4. **Export API Key**:
   ```bash
   export METABOB_API_KEY="mb_svc_your_generated_key"
   ```

### Option 3: Demo Mode (Local Only)

If you don't have access to the backend, you can run in demo mode:

1. **Create local config**:
   ```bash
   cat > demos/minibob-cicd/.metabob/config.json <<EOF
   {
     "metabob": {
       "endpoint": "http://localhost:8080",
       "demoMode": true
     },
     "providers": {
       "anthropic": { "apiKey": "$ANTHROPIC_API_KEY" }
     }
   }
   EOF
   ```

2. **Note**: Demo mode limitations:
   - No trace storage (learning loops won't persist)
   - No Thompson Sampling updates
   - No impulse relevance tracking
   - Activities still work, but won't contribute to learning

### Option 4: Request Access

Contact the Metabob team to request access:
- Email: support@metabob.com
- Discord: https://discord.gg/metabob
- Mention you're testing the MiniBob CI/CD demo

## Verify Setup

Once you have your keys:

```bash
# Test Anthropic API
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }' | jq .

# Test Metabob API
curl -s https://activity.metabob.com/v2/activities/templates?limit=1 \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

Expected outputs:
- Anthropic: JSON with `"content"` array
- Metabob: JSON with `"templates"` array

## Configuration File

Create `~/.metabob/config.json`:

```json
{
  "metabob": {
    "apiKey": "YOUR_METABOB_API_KEY",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": {
      "apiKey": "YOUR_ANTHROPIC_API_KEY"
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

Or set project-level config in `demos/minibob-cicd/.metabob/config.json` (already exists - just update with your keys).

## Environment Variables (Alternative)

Instead of config file, you can use environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export METABOB_API_KEY="mb_live_..."
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"  # Optional
```

## Troubleshooting

### "Authentication failed"

- Check API key is correct (copy-paste carefully)
- Verify key is active (not revoked)
- Ensure no extra whitespace in key

### "Connection refused"

- Check endpoint URL (https://activity.metabob.com)
- Verify network connectivity
- Try from different network if behind firewall

### "Rate limit exceeded"

- Anthropic: Check usage at https://console.anthropic.com/settings/usage
- Metabob: Check plan limits, upgrade if needed

## Next Steps

Once you have your API keys:

1. **Test the demo**:
   ```bash
   cd demos/minibob-cicd
   ./scripts/run-scenario-1-cold-start.sh
   ```

2. **Run full workflow**:
   ```bash
   ./scripts/orchestrate-development.sh "Add feature"
   ```

3. **Deploy to GitHub Pages**:
   - Push to your GitHub repository
   - Enable GitHub Pages in Settings
   - The deploy-pages.yml workflow will run automatically

4. **Monitor learning**:
   ```bash
   ./scripts/show-learning-metrics.sh
   ```

## Security Note

**Never commit API keys to git!**

The `.gitignore` already includes:
- `.metabob/config.json` (if it contains keys)
- `.env` files
- `**/secrets/**`

Always use environment variables or local config files for sensitive data.

## Questions?

- Documentation: [SETUP.md](SETUP.md)
- Quick start: [ACTIVITY_DRIVEN_QUICKSTART.md](ACTIVITY_DRIVEN_QUICKSTART.md)
- Full guide: [ACTIVITY_DRIVEN_DEVELOPMENT.md](ACTIVITY_DRIVEN_DEVELOPMENT.md)
