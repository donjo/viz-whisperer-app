# Deployment Guide for Deno Deploy

## ✅ Production Security Setup

Your app is now configured to be secure in production! The API key will never be exposed to users.

## Quick Deploy to Deno Deploy

### 1. Push your code to GitHub (if not already done)

### 2. Set up your Deno Deploy project
1. Go to [dash.deno.com](https://dash.deno.com) 
2. Create a new project
3. Connect your GitHub repository
4. Set the entry point to `main.ts`

### 3. Configure Environment Variables on Deno Deploy
In your Deno Deploy project settings, add these environment variables:

**Required:**
- `ANTHROPIC_API_KEY` = `your_actual_api_key_here` (the one from your .env.local)

**Optional:**
- `ANTHROPIC_MODEL` = `claude-sonnet-4-20250514` (or your preferred model)
- `DEPLOY_TOKEN` = `your_deno_deploy_token` (for Deno Sandbox functionality)

### 4. Deploy
Deno Deploy will automatically build and deploy your app when you push to your connected branch.

## How It Works

### Development (Local)
- Uses `VITE_ANTHROPIC_API_KEY` from `.env.local`
- Makes direct API calls from browser (fine for local dev)

### Production (Deno Deploy)
- Uses `ANTHROPIC_API_KEY` server environment variable
- API calls go through your backend endpoint at `/api/generate-visualization`
- Frontend never sees the API key ✅

## Testing Production Setup Locally

To test the production setup on your local machine:

1. Build the project:
   ```bash
   deno task build
   ```

2. Set environment variables and run the server:
   ```bash
   ANTHROPIC_API_KEY=your_key_here deno run -A main.ts
   ```

3. Visit the local server (Deno will show you the URL)

## Security Benefits ✅

- ✅ API key never exposed to users
- ✅ Server-side API calls only
- ✅ Rate limiting possible (add to main.ts if needed)
- ✅ User authentication possible (add to main.ts if needed)
- ✅ Generated code validation possible (already implemented)
- ✅ Deno Sandbox isolation for generated code (when DEPLOY_TOKEN is configured)

## Deno Sandbox Features

When `DEPLOY_TOKEN` is configured, visualizations will render in fully isolated Deno sandboxes instead of iframes:

- **Enhanced Security**: Complete process isolation rather than browser sandbox
- **Better Performance**: Native HTTP server environment for complex visualizations  
- **Real Environment**: Closer to production deployment conditions
- **Automatic Fallback**: Falls back to iframe rendering if sandbox creation fails

## Cost Management

With the backend approach, you can now add:
- Rate limiting per user/IP
- Caching of generated visualizations
- Usage analytics
- User authentication and quotas

## Environment Variables Summary

**For Deno Deploy:**
- `ANTHROPIC_API_KEY` - Your Anthropic API key (stored securely)
- `ANTHROPIC_MODEL` - Model to use (optional, defaults to claude-sonnet-4-20250514)
- `DEPLOY_TOKEN` - Deno Deploy token for sandbox functionality (optional, enables enhanced isolation)

**For Local Development:**
- `VITE_ANTHROPIC_API_KEY` - Your Anthropic API key (in .env.local)
- `VITE_ANTHROPIC_MODEL` - Model to use (optional)
- `DEPLOY_TOKEN` - Deno Deploy token for sandbox functionality (optional, for testing sandbox features locally)