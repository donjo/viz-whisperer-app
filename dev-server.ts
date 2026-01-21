/// <reference lib="deno.ns" />
import { serveDir } from "@std/http/file-server";

// Existing API handlers
import generateVisualization from "./api/generate-visualization.ts";
import sandboxStatus from "./api/sandbox-status.ts";
import sandboxContent from "./api/sandbox-content.ts";
import deploymentStatus from "./api/deployment-status.ts";
import testDeployment from "./api/test-deployment.ts";
import debugFrontend from "./api/debug-frontend.ts";

// Auth handlers
import authLogin from "./api/auth/login.ts";
import authCallback from "./api/auth/callback.ts";
import authLogout from "./api/auth/logout.ts";
import authMe from "./api/auth/me.ts";

// Settings handlers
import settingsApiKey from "./api/settings/api-key.ts";

// Visualization handlers
import visualizations from "./api/visualizations.ts";
import visualizationById from "./api/visualizations/[id].ts";
import visualizationShare from "./api/visualizations/[id]/share.ts";

// Public share handler
import shareByPublicId from "./api/share/[publicId].ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Add CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Handle API routes
  let response: Response;

  // Auth routes
  if (url.pathname === "/api/auth/login") {
    response = await authLogin(req);
  } else if (url.pathname === "/api/auth/callback") {
    response = await authCallback(req);
  } else if (url.pathname === "/api/auth/logout") {
    response = await authLogout(req);
  } else if (url.pathname === "/api/auth/me") {
    response = await authMe(req);
  } // Settings routes
  else if (url.pathname === "/api/settings/api-key") {
    response = await settingsApiKey(req);
  } // Visualization routes (order matters - more specific first)
  else if (url.pathname.match(/^\/api\/visualizations\/[^/]+\/share$/)) {
    response = await visualizationShare(req);
  } else if (url.pathname.match(/^\/api\/visualizations\/[^/]+$/)) {
    response = await visualizationById(req);
  } else if (url.pathname === "/api/visualizations") {
    response = await visualizations(req);
  } // Existing routes
  else if (url.pathname === "/api/generate-visualization") {
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
  } // Public share route
  else if (url.pathname.match(/^\/api\/share\/[^/]+$/)) {
    response = await shareByPublicId(req);
  } else {
    // For development, just return a simple response for other routes
    response = new Response("API Server Running", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  // Add CORS headers to the response by creating a new Response
  // (some responses like redirects have immutable headers)
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Development server entry point
const port = parseInt(
  Deno.args.find((arg) => arg.startsWith("--port="))?.split("=")[1] || "3000",
);
console.log(`🚀 API Server starting on http://localhost:${port}`);
console.log(`📦 DEPLOY_TOKEN configured: ${!!Deno.env.get("DEPLOY_TOKEN")}`);

Deno.serve({ port, hostname: "0.0.0.0" }, handler);
