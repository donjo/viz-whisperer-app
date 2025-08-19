/// <reference lib="deno.ns" />
import { serveDir } from "@std/http/file-server";
import generateVisualization from "./api/generate-visualization.ts";
import sandboxStatus from "./api/sandbox-status.ts";
import sandboxContent from "./api/sandbox-content.ts";
import deploymentStatus from "./api/deployment-status.ts";
import testDeployment from "./api/test-deployment.ts";
import debugFrontend from "./api/debug-frontend.ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Add CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  // Handle API routes
  let response: Response;
  if (url.pathname === "/api/generate-visualization") {
    response = await generateVisualization(req);
  } else if (url.pathname === "/api/sandbox-status") {
    response = await sandboxStatus(req);
  } else if (url.pathname === "/api/sandbox-content") {
    response = await sandboxContent(req);
  } else if (url.pathname === "/api/deployment-status") {
    response = await deploymentStatus(req);
  } else if (url.pathname === "/api/test-deployment") {
    response = await testDeployment(req);
  } else if (url.pathname === "/api/debug-frontend") {
    response = await debugFrontend(req);
  } else {
    // For development, just return a simple response for other routes
    response = new Response("API Server Running", { 
      status: 200,
      headers: { "content-type": "text/plain" }
    });
  }
  
  // Add CORS headers to the response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

// Development server entry point
const port = parseInt(Deno.args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');
console.log(`🚀 API Server starting on http://localhost:${port}`);
console.log(`📦 DEPLOY_TOKEN configured: ${!!Deno.env.get("DEPLOY_TOKEN")}`);

Deno.serve({ port, hostname: '0.0.0.0' }, handler);