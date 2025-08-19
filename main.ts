import { serveDir } from "@std/http/file-server";
import generateVisualization from "./api/generate-visualization.ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Handle API routes
  if (url.pathname === "/api/generate-visualization") {
    return await generateVisualization(req);
  }
  
  // Serve static files from the dist directory
  if (url.pathname.startsWith("/dist/") || url.pathname.startsWith("/assets/")) {
    return serveDir(req, {
      fsRoot: "./dist",
      urlRoot: "",
    });
  }
  
  // For all other routes, serve the index.html (SPA routing)
  try {
    if (url.pathname === "/" || !url.pathname.includes(".")) {
      const indexContent = await Deno.readTextFile("./dist/index.html");
      return new Response(indexContent, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    
    // Try to serve static file
    return serveDir(req, {
      fsRoot: "./dist",
    });
  } catch {
    // If file not found, serve index.html for SPA routing
    const indexContent = await Deno.readTextFile("./dist/index.html");
    return new Response(indexContent, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}

export default { fetch: handler };