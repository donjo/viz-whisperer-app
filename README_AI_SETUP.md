# AI Integration Setup Guide

## Quick Start

### 1. Get Your Anthropic API Key
Visit [Anthropic Console](https://console.anthropic.com/settings/keys) to create an API key.

### 2. Configure Your Environment
Add your API key to `.env.local`:
```bash
VITE_ANTHROPIC_API_KEY=your_actual_api_key_here
```

### 3. Start the Development Server
```bash
deno task dev
# or
npm run dev
```

### 4. Test the Integration

#### Sample API URLs to Test:
- **GitHub API**: `https://api.github.com/repos/facebook/react/commits`
- **JSONPlaceholder**: `https://jsonplaceholder.typicode.com/posts`
- **Random User**: `https://randomuser.me/api/?results=10`

#### Sample Prompts to Try:
1. "Create a bar chart showing commit activity over time"
2. "Build an interactive pie chart with the data"
3. "Make a line graph with animated transitions"
4. "Create a dashboard with multiple chart types"

## How It Works

1. **Data Fetching**: Enter an API URL in the input field
2. **AI Generation**: Add a prompt describing your desired visualization
3. **Real-time Preview**: The visualization appears in the preview window
4. **Iteration**: Use the chat interface to refine the visualization

## Features

- **Automatic Fallback**: If no API key is configured, the app uses mock data
- **Status Indicator**: Check the header badge to see if AI is active
- **Error Handling**: Graceful fallback to demo mode if AI fails
- **Cost Efficient**: Uses Claude Haiku by default (cheapest model)

## Customization

### Change the AI Model
In `.env.local`, you can specify a different model:
```bash
VITE_ANTHROPIC_MODEL=claude-3-opus-20240229  # More powerful, more expensive
VITE_ANTHROPIC_MODEL=claude-3-sonnet-20240229  # Balanced
VITE_ANTHROPIC_MODEL=claude-3-haiku-20240307  # Default, most cost-effective
```

## Troubleshooting

### API Key Not Working?
- Check that your key starts with `sk-ant-`
- Ensure you've saved `.env.local` file
- Restart the dev server after adding the key

### Visualization Not Generating?
- Check the browser console for errors
- Verify your API key has sufficient credits
- Try a simpler prompt first

## Next Steps for Production

For production deployment, you'll want to:

1. **Move AI calls to backend**: Create an API endpoint to protect your key
2. **Add rate limiting**: Prevent abuse of your AI quota
3. **Implement caching**: Store generated visualizations
4. **Use a sandbox**: Run generated code in an isolated environment
5. **Add user authentication**: Track usage per user

## Cost Estimation

With Claude Haiku (default):
- Input: ~$0.25 per million tokens
- Output: ~$1.25 per million tokens
- Average visualization: ~2000 tokens = ~$0.003 per generation

## Security Notes

⚠️ **Development Only**: The current setup exposes your API key in the browser. This is fine for local development but NOT for production.

For production, implement a backend service that:
- Stores the API key securely server-side
- Validates user requests
- Handles rate limiting
- Sanitizes generated code