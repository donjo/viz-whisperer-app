# Viz Whisperer App

A React application built with Vite, TypeScript, and shadcn-ui, powered by Deno 2.

## Prerequisites

- [Deno 2.x](https://docs.deno.com/runtime/getting_started/installation/) installed

## Getting Started

### Clone and Install

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd viz-whisperer-app

# Install dependencies (Deno will handle npm packages automatically)
deno install
```

### Development

```sh
# Start the development server
deno task dev

# The app will be available at http://localhost:8080
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

## Why Deno?

This project uses Deno 2, which provides:

- **Native TypeScript support** - No need for separate TypeScript compilation
- **Built-in tools** - Linting, formatting, and testing without additional dependencies
- **Simplified configuration** - Removed ESLint and other config files
- **npm compatibility** - Can still use all npm packages from package.json
- **Better security** - Deno's permission system (currently using -A flag for development)

## Technologies

- **Deno 2** - JavaScript/TypeScript runtime
- **Vite** - Build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **shadcn-ui** - Component library
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend services

## Project Structure

```
├── deno.json          # Deno configuration and task definitions
├── package.json       # npm dependencies (used by Deno)
├── vite.config.ts     # Vite configuration
├── tailwind.config.ts # Tailwind CSS configuration
├── tsconfig.json      # TypeScript configuration
├── src/
│   ├── main.tsx       # Application entry point
│   ├── App.tsx        # Main App component
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions
│   └── integrations/  # External service integrations
└── public/            # Static assets
```

## Notes on Deno Setup

This project was converted from a Node.js/npm setup to Deno 2. The following changes were made:

- Added `deno.json` for Deno configuration and task definitions
- Updated `vite.config.ts` to use Deno-compatible imports
- Removed `eslint.config.js` (using Deno's built-in linter instead)
- Removed `tsconfig.node.json` (not needed with Deno)
- Kept `package.json` for npm package compatibility
- Kept `postcss.config.js` and `tailwind.config.ts` as they're still needed

The application code remains unchanged and all npm packages work seamlessly with Deno's npm compatibility layer.