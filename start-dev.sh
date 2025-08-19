#!/bin/bash

# Start both development servers
echo "🚀 Starting Viz Whisperer development environment..."
echo "📦 Frontend: http://localhost:8080 (or 8081 if 8080 is busy)"
echo "🔌 API Server: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Start API server in background
deno run -A --env-file=.env.local --watch dev-server.ts --port=3000 &
API_PID=$!

# Start Vite dev server in background  
deno run -A npm:vite &
VITE_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    kill $API_PID 2>/dev/null
    kill $VITE_PID 2>/dev/null
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait