# Viz Whisperer App

A data visualization assistant that transforms natural language into interactive charts and visualizations. Built with React, Vite, TypeScript, and shadcn-ui, powered by Deno 2.

## Prerequisites

- [Deno 2.x](https://docs.deno.com/runtime/getting_started/installation/) installed
- An Anthropic API key (for AI-powered visualization generation)

## Getting Started

### Clone and Setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd viz-whisperer-app

# Create a .env.local file with your API key
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env.local

# Dependencies are managed in deno.json - no install needed!
```

### Development

```sh
# Start both frontend and API servers
deno task dev:full

# Or run them separately:
deno task dev      # Frontend at http://localhost:8080
deno task dev:api  # API server at http://localhost:3000
```

### Building

```sh
# Build for production
deno task build

# Build for development
deno task build:dev
```

### Preview Production Build

```sh
# Preview the production build
deno task preview
```

### Linting and Formatting

```sh
# Run Deno's built-in linter
deno task lint

# Format code with Deno's formatter
deno task fmt

# Type check the project
deno task check
```

## Technologies

- **Deno 2** - JavaScript/TypeScript runtime with built-in tooling
- **Vite** - Lightning-fast build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety (native support via Deno)
- **shadcn-ui** - Modern component library
- **Tailwind CSS** - Utility-first CSS framework
- **Anthropic Claude** - AI-powered visualization generation
- **Deno Sandbox** - Secure code execution environment

## Project Structure

```
├── deno.json          # Deno configuration, dependencies, and tasks
├── vite.config.ts     # Vite configuration
├── tailwind.config.ts # Tailwind CSS configuration
├── dev-server.ts      # API server for handling AI requests
├── start-dev.sh       # Development startup script
├── api/               # API endpoints
│   ├── generate-visualization.ts
│   ├── sandbox-*.ts   # Sandbox-related endpoints
│   └── deployment-*.ts
├── src/
│   ├── main.tsx       # Application entry point
│   ├── App.tsx        # Main App component
│   ├── components/    # React components
│   │   ├── ChatInterface.tsx
│   │   ├── PreviewWindow.tsx
│   │   └── ui/        # shadcn-ui components
│   ├── services/      # Business logic
│   │   ├── anthropicService.ts
│   │   └── sandboxService.ts
│   ├── pages/         # Page components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions
│   └── integrations/  # External service integrations
└── public/            # Static assets
```

## Key Features

- **Natural Language to Visualization**: Describe your data visualization needs in plain English
- **Live Preview**: See your visualizations render on the web in real-time
- **Secure Execution**: Code runs in isolated Deno sandbox environment
- **Multiple Chart Types**: Support for various chart libraries and visualization types
- **Export Ready**: Generate standalone browser-native HTML/JS code for your visualizations

## Architecture Notes

This project uses Deno 2 for several advantages:

- **All-in-one tooling**: No separate linter, formatter, or test runner needed
- **Native TypeScript**: Direct TypeScript execution without compilation step
- **Secure by default**: Granular permission system for enhanced security
- **NPM compatibility**: All npm packages work via Deno's compatibility layer
- **Simplified config**: Single `deno.json` manages dependencies, tasks, and configuration