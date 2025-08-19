/// <reference lib="deno.ns" />
import { serveDir } from "@std/http/file-server";
import generateVisualization from "./api/generate-visualization.ts";
import sandboxStatus from "./api/sandbox-status.ts";
import sandboxContent from "./api/sandbox-content.ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Handle API routes
  if (url.pathname === "/api/generate-visualization") {
    return await generateVisualization(req);
  }
  if (url.pathname === "/api/sandbox-status") {
    return await sandboxStatus(req);
  }
  if (url.pathname === "/api/sandbox-content") {
    return await sandboxContent(req);
  }
  
  // For development, just return a simple response for other routes
  return new Response("API Server Running", { 
    status: 200,
    headers: { "content-type": "text/plain" }
  });
}

// Development server entry point
const port = parseInt(Deno.args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');
console.log(`🚀 API Server starting on http://localhost:${port}`);
console.log(`📦 DEPLOY_TOKEN configured: ${!!Deno.env.get("DEPLOY_TOKEN")}`);

Deno.serve({ port, hostname: '0.0.0.0' }, handler);