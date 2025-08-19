import { Sandbox, type JsRuntime } from "@deno/sandbox";

interface SandboxVisualization {
  id: string;
  sandbox: Sandbox;
  runtime: JsRuntime;
  url: string;
  createdAt: Date;
}

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

class SandboxService {
  private activeSandboxes = new Map<string, SandboxVisualization>();
  private deployToken: string;

  constructor() {
    // Get the deploy token from environment variables
    // @ts-ignore - Deno global is available in the server environment
    this.deployToken = (globalThis as any).Deno?.env?.get("DEPLOY_TOKEN") || "";
    if (!this.deployToken) {
      console.warn("DEPLOY_TOKEN not configured - sandbox functionality will be limited");
    }
  }

  /**
   * Creates a new sandbox and deploys the visualization code as an HTTP server
   */
  async createVisualization(generatedCode: GeneratedCode): Promise<{ id: string; url: string }> {
    const id = crypto.randomUUID();
    
    try {
      // Create a new sandbox
      const sandbox = await Sandbox.create();
      
      // Generate Deno server code that serves the visualization
      const serverCode = this.generateServerCode(generatedCode);
      
      // Create a JavaScript runtime with the server code
      const runtime = await sandbox.createJsRuntime({
        code: serverCode
      });
      
      // Wait for the HTTP server to be ready
      const isReady = await runtime.httpReady;
      if (!isReady) {
        throw new Error("Sandbox runtime failed to start HTTP server");
      }
      
      // For now, we'll use a localhost-style URL since we can't deploy to Deno Deploy
      // In a full implementation, you'd use the Deno Deploy API here
      const url = `sandbox-${id}.local`;
      
      const visualization: SandboxVisualization = {
        id,
        sandbox,
        runtime,
        url,
        createdAt: new Date()
      };
      
      this.activeSandboxes.set(id, visualization);
      
      console.log(`Created sandbox visualization ${id} at ${url}`);
      return { id, url };
      
    } catch (error) {
      console.error("Failed to create sandbox visualization:", error);
      throw new Error(`Failed to create sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Makes an HTTP request to a sandbox visualization
   */
  async fetchFromSandbox(id: string, path = "/"): Promise<Response> {
    const visualization = this.activeSandboxes.get(id);
    if (!visualization) {
      throw new Error(`Sandbox ${id} not found`);
    }

    try {
      // Use the runtime's fetch method to make requests to the HTTP server
      const response = await visualization.runtime.fetch(`https://localhost${path}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch from sandbox ${id}:`, error);
      throw new Error(`Sandbox request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets the URL for a sandbox visualization
   */
  getSandboxUrl(id: string): string | null {
    const visualization = this.activeSandboxes.get(id);
    return visualization ? visualization.url : null;
  }

  /**
   * Cleanup a specific sandbox
   */
  async destroySandbox(id: string): Promise<void> {
    const visualization = this.activeSandboxes.get(id);
    if (!visualization) {
      return;
    }

    try {
      await visualization.runtime.kill();
      await visualization.sandbox[Symbol.asyncDispose]();
      this.activeSandboxes.delete(id);
      console.log(`Destroyed sandbox ${id}`);
    } catch (error) {
      console.error(`Failed to destroy sandbox ${id}:`, error);
    }
  }

  /**
   * Cleanup old sandboxes (older than 1 hour)
   */
  async cleanupOldSandboxes(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const toDestroy: string[] = [];

    for (const [id, visualization] of this.activeSandboxes) {
      if (visualization.createdAt < oneHourAgo) {
        toDestroy.push(id);
      }
    }

    for (const id of toDestroy) {
      await this.destroySandbox(id);
    }

    if (toDestroy.length > 0) {
      console.log(`Cleaned up ${toDestroy.length} old sandboxes`);
    }
  }

  /**
   * Cleanup all active sandboxes
   */
  async destroyAllSandboxes(): Promise<void> {
    const ids = Array.from(this.activeSandboxes.keys());
    for (const id of ids) {
      await this.destroySandbox(id);
    }
  }

  /**
   * Get statistics about active sandboxes
   */
  getStats(): { active: number; oldest?: Date } {
    const active = this.activeSandboxes.size;
    let oldest: Date | undefined;

    for (const visualization of this.activeSandboxes.values()) {
      if (!oldest || visualization.createdAt < oldest) {
        oldest = visualization.createdAt;
      }
    }

    return { active, oldest };
  }

  /**
   * Generates Deno server code that serves the visualization
   */
  private generateServerCode(generatedCode: GeneratedCode): string {
    const { html, css, javascript } = generatedCode;
    
    // Create a complete HTML document
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Visualization</title>
    <style>
${css}
    </style>
</head>
<body>
    ${html}
    <script>
${javascript}
    </script>
</body>
</html>`;

    // Generate the Deno server code
    return `
// Deno server code for data visualization
const html = ${JSON.stringify(fullHtml)};

// Create the HTTP server
Deno.serve({
  port: 8000,
  hostname: "0.0.0.0"
}, (request) => {
  const url = new URL(request.url);
  
  // Handle different routes
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  
  // Return 404 for other paths
  return new Response("Not Found", { 
    status: 404,
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  });
});

console.log("Data visualization server running on http://localhost:8000");
`;
  }

  /**
   * Check if the sandbox service is properly configured
   */
  isConfigured(): boolean {
    return !!this.deployToken;
  }
}

// Export a singleton instance
export const sandboxService = new SandboxService();

// Export types for use in other files
export type { SandboxVisualization, GeneratedCode };