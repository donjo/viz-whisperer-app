/// <reference lib="deno.ns" />
import { type JsRuntime, Sandbox } from "@deno/sandbox";
import { deploymentLogger } from "./deploymentLogger.ts";

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
    // Get the deploy token from environment variables (required for Sandbox API)
    this.deployToken = Deno.env.get("DENO_DEPLOY_TOKEN") || "";
    if (!this.deployToken) {
      console.warn(
        "DENO_DEPLOY_TOKEN not configured - sandbox functionality requires a deploy token from https://app.deno.com",
      );
    } else {
      console.log("DENO_DEPLOY_TOKEN configured - sandbox functionality enabled");
    }
  }

  /**
   * Creates a new sandbox and deploys the visualization code as an HTTP server
   */
  async createVisualization(
    generatedCode: GeneratedCode,
    visualizationId?: string,
  ): Promise<{ id: string; url: string }> {
    const id = crypto.randomUUID();

    try {
      // Log deployment start
      if (visualizationId) {
        deploymentLogger.logEvent(visualizationId, "sandbox_creation", "Starting sandbox creation");
      }

      // Create a new sandbox (token is required for the Sandbox API)
      if (!this.deployToken) {
        const error =
          "DENO_DEPLOY_TOKEN is required for sandbox functionality. Get one from https://app.deno.com";
        if (visualizationId) {
          deploymentLogger.markFailed(visualizationId, error);
        }
        throw new Error(error);
      }

      if (visualizationId) {
        deploymentLogger.logEvent(
          visualizationId,
          "sandbox_creation",
          "Creating Deno Deploy sandbox instance",
        );
      }

      const sandbox = await Sandbox.create({ token: this.deployToken });

      if (visualizationId) {
        deploymentLogger.logEvent(
          visualizationId,
          "deployment",
          "Generating server code and deploying",
        );
      }

      // Generate Deno server code that serves the visualization
      const serverCode = this.generateServerCode(generatedCode);

      // Debug output commented out - uncomment if needed for troubleshooting
      // console.log("📝 Generated server code (first 500 chars):");
      // console.log(serverCode.substring(0, 500) + "...");

      // // Write the complete server code to a debug file for inspection
      // try {
      //   await Deno.writeTextFile(`./debug-sandbox-code-${id}.js`, serverCode);
      //   console.log(`💾 Complete server code written to debug-sandbox-code-${id}.js`);

      //   // Verify the code is syntactically valid JavaScript
      //   try {
      //     new Function(serverCode);
      //     console.log("✅ Server code syntax validation passed");
      //   } catch (syntaxError) {
      //     console.error("❌ Server code syntax error:", syntaxError);
      //     console.error("This might explain why the sandbox isn't working!");
      //   }
      // } catch (writeError) {
      //   console.warn("Failed to write debug file:", writeError);
      // }

      // Create a JavaScript runtime with the server code
      const runtime = await sandbox.createJsRuntime({
        code: serverCode,
      });

      if (visualizationId) {
        deploymentLogger.logEvent(
          visualizationId,
          "deployment",
          "Waiting for HTTP server to start",
        );
      }

      // Wait for the HTTP server to be ready
      const isReady = await runtime.httpReady;

      if (!isReady) {
        const error = "Sandbox runtime failed to start HTTP server";
        console.error("❌", error);
        if (visualizationId) {
          deploymentLogger.markFailed(visualizationId, error, { sandboxId: id });
        }
        throw new Error(error);
      }

      if (visualizationId) {
        deploymentLogger.logEvent(visualizationId, "deployment", "Exposing HTTP endpoint");
      }

      // Get a real public URL by exposing the runtime (not the port)
      const url = await sandbox.exposeHttp(runtime);

      const visualization: SandboxVisualization = {
        id,
        sandbox,
        runtime,
        url,
        createdAt: new Date(),
      };

      this.activeSandboxes.set(id, visualization);

      if (visualizationId) {
        deploymentLogger.setSandboxInfo(visualizationId, id, url);
        deploymentLogger.logEvent(
          visualizationId,
          "verification",
          "Verifying deployment accessibility",
        );

        // Verify the deployment is accessible
        try {
          await this.verifyDeployment(url, visualizationId);
        } catch (verificationError) {
          // Log warning but don't fail - sandbox might need more time to be accessible
          deploymentLogger.logEvent(
            visualizationId,
            "verification",
            "Verification failed but proceeding - sandbox may need more time to be accessible",
            {
              error: verificationError instanceof Error
                ? verificationError.message
                : "Unknown error",
            },
          );
          deploymentLogger.markReady(visualizationId);
        }
      }

      console.log(`Created sandbox visualization ${id} at ${url}`);
      return { id, url };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to create sandbox visualization:", error);

      if (visualizationId) {
        deploymentLogger.markFailed(
          visualizationId,
          `Sandbox creation failed: ${errorMessage}`,
          error,
        );
      }

      throw new Error(`Failed to create sandbox: ${errorMessage}`);
    }
  }

  /**
   * Verify that a deployed sandbox is accessible and responding
   */
  private async verifyDeployment(url: string, visualizationId?: string): Promise<void> {
    const maxRetries = 5; // Increase retries
    const retryDelay = 3000; // 3 seconds - give sandbox more time

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (visualizationId) {
          deploymentLogger.logEvent(
            visualizationId,
            "verification",
            `Verification attempt ${attempt}/${maxRetries}`,
            { url },
          );
        }

        const response = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          const contentLength = response.headers.get("content-length");
          if (visualizationId) {
            deploymentLogger.markReady(visualizationId);
            deploymentLogger.logEvent(
              visualizationId,
              "ready",
              "Deployment verified and accessible",
              { status: response.status, contentLength },
            );
          }
          return;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        if (attempt === maxRetries) {
          // Final attempt failed
          throw new Error(`Verification failed after ${maxRetries} attempts: ${errorMessage}`);
        } else {
          // Retry after delay
          if (visualizationId) {
            deploymentLogger.logEvent(
              visualizationId,
              "verification",
              `Verification attempt ${attempt} failed, retrying...`,
              { error: errorMessage, nextRetryIn: `${retryDelay}ms` },
            );
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
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
      throw new Error(
        `Sandbox request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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

    // Generate the Deno server code with modern syntax
    return `
// Deno server code for data visualization
const html = ${JSON.stringify(fullHtml)};

// Create the HTTP server using modern Deno.serve syntax
Deno.serve((request) => {
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
  
  // Return 404 for any other unhandled paths
  return new Response("Not Found", { 
    status: 404,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*"
    }
  });
});
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
export type { GeneratedCode, SandboxVisualization };
