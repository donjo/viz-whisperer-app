# Development Guide

## Quick Start

### Prerequisites
- Deno installed
- Valid `ANTHROPIC_API_KEY` in `.env.local`
- Valid `DEPLOY_TOKEN` in `.env.local` for sandbox functionality

### Running the Development Environment

**Option 1: Start Both Servers Together**
```bash
deno task dev:full
# or
./start-dev.sh
```

**Option 2: Start Servers Separately**
```bash
# Terminal 1 - API Server
deno task dev:api

# Terminal 2 - Frontend
deno task dev
```

### Available URLs
- **Frontend**: http://localhost:8080 (or 8081 if 8080 is busy)
- **API Server**: http://localhost:3000
- **API Endpoints**:
  - `POST /api/generate-visualization` - Generate visualizations with sandbox deployment
  - `GET /api/sandbox-status` - Check sandbox configuration status
  - `GET /api/sandbox-content?id={sandboxId}` - Fetch content from a specific sandbox

## Development Architecture

### Frontend (Vite + React)
- Runs on port 8080/8081
- Proxies API requests to port 3000
- Uses React with TypeScript
- Styled with Tailwind CSS

### API Server (Deno)
- Runs on port 3000
- Handles AI visualization generation
- Manages Deno Deploy sandbox creation
- Serves as proxy target for frontend

### Sandbox Integration
- **With DEPLOY_TOKEN**: Creates real Deno Deploy sandboxes with URLs like `https://viz-{id}.deno.dev`
- **Without DEPLOY_TOKEN**: Falls back to iframe rendering (not recommended for development)

## Environment Variables

### Required in `.env.local`
```bash
# Anthropic API Keys
VITE_ANTHROPIC_API_KEY=your_key_here      # For frontend (legacy)
ANTHROPIC_API_KEY=your_key_here           # For API server

# Deno Deploy Token  
DEPLOY_TOKEN=your_deploy_token_here       # For sandbox functionality

# Optional
VITE_ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

## Features

### Sandbox Visualization
- Real Deno Deploy sandbox creation during development
- Live sandbox URLs that can be shared
- Enhanced security with full process isolation
- Automatic cleanup of old sandboxes

### Preview Window Features
- **Sandbox Badge**: Shows when using sandbox vs iframe
- **Sandbox URL Display**: Shows the actual sandbox URL in header
- **Copy URL Button**: Copy sandbox URL to clipboard
- **Open Sandbox Button**: Open sandbox in new tab (for production URLs)
- **Debug Information**: Detailed sandbox info in debug tab

### Development Benefits
- **Hot Reload**: Both servers support file watching
- **Real Environment**: Test with actual Deno Deploy sandboxes
- **API Proxy**: Seamless frontend-to-API communication
- **Clean Warnings**: No Deno deployment warnings

## Troubleshooting

### Common Issues

**"Sandbox functionality disabled"**
- Check that `DEPLOY_TOKEN` is set in `.env.local`
- Restart the API server after adding the token

**"API key not configured"**
- Ensure `ANTHROPIC_API_KEY` is set in `.env.local` (not just `VITE_ANTHROPIC_API_KEY`)
- Restart the API server after adding the key

**"Connection refused on API calls"**
- Make sure the API server is running on port 3000
- Check that Vite proxy configuration is working

**Port conflicts**
- Vite will automatically try port 8081 if 8080 is busy
- You can manually specify ports if needed

### Checking Status
```bash
# Check if API server is running
curl http://localhost:3000/api/sandbox-status

# Check if proxy is working
curl http://localhost:8080/api/sandbox-status
```

## Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).