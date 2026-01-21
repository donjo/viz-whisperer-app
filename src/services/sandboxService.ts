/// <reference lib="deno.ns" />
import { type DenoProcess, Sandbox } from "@deno/sandbox";
import { deploymentLogger } from "./deploymentLogger.ts";

// Configuration constants
const CONFIG = {
  RETRY: {
    MAX_ATTEMPTS: 5,
    DELAY_MS: 3000,
    TIMEOUT_MS: 10000,
  },
  CLEANUP: {
    OLD_SANDBOX_THRESHOLD_MS: 60 * 60 * 1000, // 1 hour
  },
  SANDBOX: {
    CREATION_TIMEOUT_MS: 30000, // 30 seconds for sandbox creation
  },
} as const;

interface SandboxVisualization {
  id: string;
  sandbox: Sandbox;
  runtime: DenoProcess;
  url: string;
  createdAt: Date;
}

interface VisualizationRequest {
  apiData: {
    url: string;
    data: any[];
    structure: {
      fields: Array<{
        name: string;
        type: string;
        sample: any;
      }>;
      totalRecords: number;
    };
  };
  prompt: string;
  currentCode?: {
    html: string;
    css: string;
    javascript: string;
  };
}

// The visualization generator code that runs inside the sandbox
// This is embedded as a string so we can write it to the sandbox filesystem
const VISUALIZATION_GENERATOR_CODE = `
/**
 * Visualization Generator - Runs INSIDE the sandbox
 * API key is securely injected via secrets feature
 */
import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

interface VisualizationRequest {
  apiData: {
    url: string;
    data: any[];
    structure: {
      fields: Array<{ name: string; type: string; sample: any }>;
      totalRecords: number;
    };
  };
  prompt: string;
  currentCode?: { html: string; css: string; javascript: string };
  model?: string;
}

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

// Phase tracking for status endpoint
let generationPhase = "initializing";
let generationStartTime = Date.now();

const requestJson = Deno.args[0];
console.log("Starting visualization generator...");
console.log("ANTHROPIC_API_KEY set:", !!Deno.env.get("ANTHROPIC_API_KEY"));

if (!requestJson) {
  console.error("No request data provided");
  Deno.exit(1);
}

let request: VisualizationRequest;
try {
  generationPhase = "parsing_request";
  request = JSON.parse(requestJson);
  console.log("Request parsed successfully, prompt:", request.prompt?.substring(0, 50));
} catch (error) {
  console.error("Failed to parse request JSON:", error);
  Deno.exit(1);
}

let anthropic: Anthropic;
try {
  generationPhase = "creating_client";
  anthropic = new Anthropic();
  console.log("Anthropic client created successfully");
} catch (error) {
  console.error("Failed to create Anthropic client:", error);
  throw error;
}

const systemPrompt = \`You are a data visualization expert. Generate HTML/CSS/JavaScript chart code.

CRITICAL: Your response must be ONLY a valid JSON object. No explanation, no markdown, no text before or after.

Response format (exactly this structure):
{
  "html": "<div id='chart'></div>",
  "css": "body { ... }",
  "javascript": "// chart code"
}

Requirements:
1. Use vanilla JavaScript with HTML5 Canvas or SVG (no external libraries)
2. Dark theme: background #0f0f23, text #e2e8f0, accent #60a5fa
3. Make it responsive with hover effects and labels
4. Filter data based on user's time period or limit requests
5. Include a chart title showing what data subset is displayed

RESPOND WITH JSON ONLY. NO OTHER TEXT.\`;

function buildUserPrompt(req: VisualizationRequest): string {
  const { apiData, prompt, currentCode } = req;
  const dateFields = apiData.structure.fields.filter((field) => {
    const fieldName = field.name.toLowerCase();
    const sampleValue = String(field.sample);
    const dateNamePatterns = ["date", "time", "created", "updated", "modified", "timestamp"];
    const hasDateName = dateNamePatterns.some((p) => fieldName.includes(p));
    const datePatterns = [/^\\d{4}-\\d{2}-\\d{2}/, /^\\d{2}\\/\\d{2}\\/\\d{4}/, /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/];
    const hasDateFormat = datePatterns.some((p) => p.test(sampleValue));
    return hasDateName || hasDateFormat;
  });

  let userPrompt = \`Create a data visualization with the following specifications:
  Data Source: \${apiData.url}
  Total Records: \${apiData.structure.totalRecords}
  Data Structure:
  \${apiData.structure.fields.map((f) => \`- \${f.name} (\${f.type}): \${JSON.stringify(f.sample)}\`).join("\\n")}\`;

  if (dateFields.length > 0) {
    userPrompt += \`\\n\\n  Detected Date/Time Fields:\\n  \${dateFields.map((f) => \`- \${f.name} (\${f.type}): \${JSON.stringify(f.sample)}\`).join("\\n")}\`;
  }

  userPrompt += \`\\n\\n  Sample Data (first 10 records):\\n  \${JSON.stringify(apiData.data.slice(0, 10), null, 2)}\\n\\n  User Request: \${prompt}

IMPORTANT DATA HANDLING INSTRUCTIONS:
1. If the user specifies a time period, date range, or record limit, you MUST implement filtering
2. Use JavaScript's filter(), slice(), or other array methods to limit data before visualization
3. Do NOT display all \${apiData.structure.totalRecords} records unless specifically requested\`;

  if (currentCode) {
    userPrompt += \`\\n\\n    Current Visualization Code to Modify:\\n    HTML: \${currentCode.html}\\n    CSS: \${currentCode.css}\\n    JavaScript: \${currentCode.javascript}\\n\\n    Please modify the existing code based on the user's request.\`;
  }

  return userPrompt;
}

function parseResponse(text: string): GeneratedCode {
  // Try direct parse first (most common case with prefill)
  try {
    const parsed = JSON.parse(text);
    if (parsed.html && parsed.css && parsed.javascript) {
      return { html: parsed.html, css: parsed.css, javascript: parsed.javascript };
    }
  } catch { /* fall through to regex extraction */ }

  // Fallback: extract JSON from text if direct parse fails
  const jsonPatterns = [/\\{[\\s\\S]*"javascript"[\\s\\S]*\\}/, /\\{[\\s\\S]*\\}/];
  for (const pattern of jsonPatterns) {
    const jsonMatch = text.match(pattern);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.html && parsed.css && parsed.javascript) {
          return { html: parsed.html, css: parsed.css, javascript: parsed.javascript };
        }
      } catch { continue; }
    }
  }

  console.error("Failed to parse response:", text.substring(0, 200));
  return generateFallbackChart();
}

function generateFallbackChart(): GeneratedCode {
  return {
    html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
    css: \`body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}
#chart{width:100%;height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}
canvas{max-width:100%;max-height:100%;background:rgba(30,30,60,0.3);border-radius:8px}\`,
    javascript: \`
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const resizeCanvas = () => {
  const container = canvas.parentElement;
  canvas.width = Math.min(container.clientWidth - 40, 800);
  canvas.height = Math.min(container.clientHeight - 40, 500);
  drawChart();
};
const data = [{ name: 'A', value: 400 }, { name: 'B', value: 300 }, { name: 'C', value: 300 }, { name: 'D', value: 200 }];
const drawChart = () => {
  const width = canvas.width, height = canvas.height;
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  ctx.clearRect(0, 0, width, height);
  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = chartWidth / data.length * 0.8;
  const barSpacing = chartWidth / data.length * 0.2;
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = margin.left + index * (barWidth + barSpacing) + barSpacing / 2;
    const y = margin.top + chartHeight - barHeight;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + barWidth / 2, height - margin.bottom + 20);
    ctx.fillText(item.value, x + barWidth / 2, y - 10);
  });
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartHeight);
  ctx.moveTo(margin.left, margin.top + chartHeight);
  ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Sample Data Visualization', width / 2, 25);
};
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
\`
  };
}

function buildHtml(code: GeneratedCode): string {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Visualization</title>
    <style>\${code.css}</style>
</head>
<body>
    \${code.html}
    <script>\${code.javascript}</script>
</body>
</html>\`;
}

let generatedHtml: string = "";  // Initialize empty
let generationError: string | null = null;

// Loading page shown while AI is generating the visualization
// Includes auto-refresh script that polls /status and reloads when ready
function buildLoadingHtml(): string {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generating Visualization...</title>
    <style>
      body {
        background: #0f0f23;
        color: #e2e8f0;
        margin: 0;
        font-family: Arial, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }
      .loader {
        text-align: center;
      }
      .spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(96, 165, 250, 0.3);
        border-top-color: #60a5fa;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .phase {
        color: #60a5fa;
        font-size: 14px;
        margin-top: 10px;
      }
      .elapsed {
        color: #94a3b8;
        font-size: 12px;
        margin-top: 5px;
      }
    </style>
</head>
<body>
    <div class="loader">
      <div class="spinner"></div>
      <h2>Generating Visualization</h2>
      <p class="phase" id="phase">Phase: \${generationPhase}</p>
      <p>Please wait while the AI creates your chart...</p>
      <p class="elapsed" id="elapsed"></p>
    </div>
    <script>
      // Poll /status every 2 seconds and reload when ready
      async function checkStatus() {
        try {
          const response = await fetch('/status');
          const status = await response.json();

          // Update phase display
          document.getElementById('phase').textContent = 'Phase: ' + status.phase;

          // Update elapsed time
          const seconds = Math.round(status.elapsed / 1000);
          document.getElementById('elapsed').textContent = seconds + 's elapsed';

          // Reload page when ready (visualization will be served)
          if (status.ready || status.phase === 'ready' || status.phase === 'error') {
            window.location.reload();
          }
        } catch (e) {
          console.error('Status check failed:', e);
        }
      }

      // Start polling
      setInterval(checkStatus, 2000);
      // Also check immediately
      checkStatus();
    </script>
</body>
</html>\`;
}

// Async function to generate visualization (runs in background after server starts)
async function generateVisualization() {
  try {
    generationPhase = "calling_api";
    console.log("Calling Anthropic API to generate visualization...");
    const userPrompt = buildUserPrompt(request);
    const model = request.model || Deno.env.get("MODEL") || "claude-sonnet-4-5-20250929";
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 16000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: "{" }  // Prefill forces JSON start
      ],
    });
    generationPhase = "parsing_response";
    const content = response.content[0];
    if (content.type === "text") {
      // Prepend the prefill "{" to the response since we used prefill technique
      const responseText = "{" + content.text;
      const code = parseResponse(responseText);
      generatedHtml = buildHtml(code);
      console.log("Visualization generated successfully");
    } else {
      throw new Error("Unexpected response format from AI");
    }
    generationPhase = "ready";
  } catch (error) {
    console.error("Failed to generate visualization:", error);
    generationError = error instanceof Error ? error.message : "Unknown error";
    generationPhase = "error";
    const fallback = generateFallbackChart();
    generatedHtml = buildHtml(fallback);
  }
}

// Start HTTP server FIRST (so /status endpoint is available immediately)
console.log("Starting HTTP server...");
Deno.serve((req: Request) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  if (url.pathname === "/status") {
    return Response.json({
      phase: generationPhase,
      elapsed: Date.now() - generationStartTime,
      ready: generationPhase === "ready",
      error: generationError
    }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
  if (url.pathname === "/health") {
    return Response.json({ status: generationError ? "error" : "ok", error: generationError }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    // Return loading page while still generating
    if (generationPhase !== "ready" && generationPhase !== "error") {
      return new Response(buildLoadingHtml(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    return new Response(generatedHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
  });
});

// THEN start generation (non-blocking, runs in background)
generateVisualization();
`;

class SandboxService {
  private activeSandboxes = new Map<string, SandboxVisualization>();
  private deployToken: string;

  constructor() {
    // In development, use DENO_DEPLOY_DEV_TOKEN, otherwise use DENO_DEPLOY_TOKEN
    const isDevelopment = Deno.env.get("DENO_ENV") === "development" ||
      !Deno.env.get("DENO_DEPLOYMENT_ID");
    const tokenKey = isDevelopment ? "DENO_DEPLOY_DEV_TOKEN" : "DENO_DEPLOY_TOKEN";

    this.deployToken = Deno.env.get(tokenKey) || "";
    if (!this.deployToken) {
      console.warn(
        `${tokenKey} not configured - sandbox functionality requires a deploy token from https://app.deno.com`,
      );
    } else {
      console.log(`${tokenKey} configured - sandbox functionality enabled`);
    }
  }

  /**
   * Creates a new sandbox that generates and serves a visualization
   * The sandbox makes Anthropic API calls directly using the user's API key
   *
   * @param request - The visualization request with data and prompt
   * @param userApiKey - User's Anthropic API key (injected securely via secrets)
   * @param visualizationId - Optional ID for tracking deployment progress
   */
  async createVisualization(
    request: VisualizationRequest,
    userApiKey: string,
    visualizationId?: string,
  ): Promise<{ id: string; url: string }> {
    const id = crypto.randomUUID();

    try {
      this.validateDeployToken(visualizationId);
      this.validateApiKey(userApiKey, visualizationId);

      const sandbox = await this.initializeSandboxWithSecrets(userApiKey, visualizationId);
      const runtime = await this.deployGeneratorToSandbox(sandbox, request, id, visualizationId);
      const url = await this.exposeAndRegisterSandbox(sandbox, runtime, id, visualizationId);

      await this.performPostDeploymentVerification(url, visualizationId);

      console.log(`Created sandbox visualization ${id} at ${url}`);
      return { id, url };
    } catch (error) {
      this.handleCreationError(error, id, visualizationId);
      throw error;
    }
  }

  /**
   * Creates a sandbox, waits for generation to complete, and fetches the HTML
   * This method handles the full flow: create sandbox -> wait for ready -> fetch HTML
   *
   * @param request - The visualization request with data and prompt
   * @param userApiKey - User's Anthropic API key
   * @param visualizationId - Optional ID for tracking deployment progress
   * @returns The sandbox ID and generated HTML
   */
  async createAndFetchVisualization(
    request: VisualizationRequest,
    userApiKey: string,
    visualizationId?: string,
  ): Promise<{ id: string; html: string }> {
    // Create sandbox as before
    const { id, url } = await this.createVisualization(request, userApiKey, visualizationId);

    // Poll /status until ready (with timeout)
    const maxWaitMs = 90000; // 90 seconds (Anthropic API can take 30+ seconds)
    const pollIntervalMs = 2000; // Poll every 2 seconds
    const startTime = Date.now();

    if (visualizationId) {
      deploymentLogger.logEvent(
        visualizationId,
        "verification",
        "Waiting for visualization generation to complete",
      );
    }

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const statusResponse = await this.fetchFromSandbox(id, "/status");
        const status = await statusResponse.json();

        if (visualizationId) {
          deploymentLogger.logEvent(
            visualizationId,
            "verification",
            `Generation phase: ${status.phase}`,
            { elapsed: status.elapsed },
          );
        }

        if (status.ready) {
          // Fetch the HTML
          const htmlResponse = await this.fetchFromSandbox(id, "/");
          const html = await htmlResponse.text();

          if (visualizationId) {
            deploymentLogger.logEvent(
              visualizationId,
              "ready",
              "HTML fetched successfully",
              { htmlLength: html.length },
            );
          }

          // Destroy sandbox after fetching HTML (it's no longer needed)
          await this.destroySandbox(id);

          return { id, html };
        }

        if (status.phase === "error") {
          throw new Error(status.error || "Visualization generation failed");
        }
      } catch (error) {
        // If it's not a fetch error (sandbox not ready yet), rethrow
        if (error instanceof Error && !error.message.includes("Sandbox request failed")) {
          throw error;
        }
        // Sandbox not ready yet, continue polling
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    // Clean up on timeout
    await this.destroySandbox(id);
    throw new Error("Visualization generation timed out after 90 seconds");
  }

  private validateDeployToken(visualizationId?: string): void {
    if (!this.deployToken) {
      const isDevelopment = Deno.env.get("DENO_ENV") === "development" ||
        !Deno.env.get("DENO_DEPLOYMENT_ID");
      const tokenKey = isDevelopment ? "DENO_DEPLOY_DEV_TOKEN" : "DENO_DEPLOY_TOKEN";
      const error =
        `${tokenKey} is required for sandbox functionality. Get one from https://console.deno.com`;
      if (visualizationId) {
        deploymentLogger.markFailed(visualizationId, error);
      }
      throw new Error(error);
    }
  }

  private validateApiKey(userApiKey: string, visualizationId?: string): void {
    if (!userApiKey || typeof userApiKey !== "string" || userApiKey.trim() === "") {
      const error = "Anthropic API key is required";
      if (visualizationId) {
        deploymentLogger.markFailed(visualizationId, error);
      }
      throw new Error(error);
    }
  }

  /**
   * Initialize sandbox with the user's API key
   * - API key is passed via environment variables
   * - Sandbox runs isolated code with its own process space
   */
  private async initializeSandboxWithSecrets(
    userApiKey: string,
    visualizationId?: string,
  ): Promise<Sandbox> {
    if (visualizationId) {
      deploymentLogger.logEvent(
        visualizationId,
        "sandbox_creation",
        "Starting secure sandbox creation with secrets injection",
      );
    }

    const isDevelopment = Deno.env.get("DENO_ENV") === "development" ||
      !Deno.env.get("DENO_DEPLOYMENT_ID");

    // Build sandbox options with security features
    const options: Record<string, unknown> = {
      token: this.deployToken,
      // Environment variables - API key is passed via env
      env: {
        ANTHROPIC_API_KEY: userApiKey,
        MODEL: "claude-sonnet-4-5-20250929",
      },
      // TODO: Add network restrictions once basic functionality works
      // allowNet: ["api.anthropic.com"],
    };

    if (isDevelopment) {
      options.baseUrl = "http://localhost:8000";
    }

    if (visualizationId) {
      deploymentLogger.logEvent(
        visualizationId,
        "sandbox_creation",
        "Creating sandbox with network restriction to api.anthropic.com",
      );
    }

    return await Sandbox.create(options);
  }

  /**
   * Deploy the visualization generator code to the sandbox and run it
   * The generator will call Anthropic API and serve the result
   */
  private async deployGeneratorToSandbox(
    sandbox: Sandbox,
    request: VisualizationRequest,
    sandboxId: string,
    visualizationId?: string,
  ): Promise<DenoProcess> {
    if (visualizationId) {
      deploymentLogger.logEvent(
        visualizationId,
        "deployment",
        "Writing generator code to sandbox filesystem",
      );
    }

    // Write the generator code to the sandbox filesystem
    // Inject the request data directly into the code since args may not be supported
    const requestData = JSON.stringify(request);
    const codeWithRequest = VISUALIZATION_GENERATOR_CODE.replace(
      "const requestJson = Deno.args[0];",
      `const requestJson = ${JSON.stringify(requestData)};`,
    );

    // Encode string to Uint8Array for writeFile
    const encoder = new TextEncoder();
    await sandbox.fs.writeFile("/app/generator.ts", encoder.encode(codeWithRequest));

    if (visualizationId) {
      deploymentLogger.logEvent(
        visualizationId,
        "deployment",
        "Starting visualization generator in sandbox",
      );
    }

    // Run the generator - request data is embedded in the code
    const runtime = await sandbox.deno.run({
      entrypoint: "/app/generator.ts",
    });

    if (visualizationId) {
      deploymentLogger.logEvent(
        visualizationId,
        "deployment",
        "Visualization generator started, generating visualization via Anthropic API",
      );
    }

    return runtime;
  }

  private async exposeAndRegisterSandbox(
    sandbox: Sandbox,
    runtime: DenoProcess,
    id: string,
    visualizationId?: string,
  ): Promise<string> {
    if (visualizationId) {
      deploymentLogger.logEvent(visualizationId, "deployment", "Exposing HTTP endpoint");
    }

    // Get a real public URL by exposing the runtime's process
    const url = await sandbox.exposeHttp({ pid: runtime.pid });

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
    }

    return url;
  }

  private async performPostDeploymentVerification(
    url: string,
    visualizationId?: string,
  ): Promise<void> {
    if (!visualizationId) return;

    deploymentLogger.logEvent(
      visualizationId,
      "verification",
      "Verifying deployment accessibility",
    );

    try {
      await this.verifyDeployment(url, visualizationId);
    } catch (verificationError) {
      // Log warning but don't fail - sandbox might need more time to be accessible
      deploymentLogger.logEvent(
        visualizationId,
        "verification",
        "Verification failed but proceeding - sandbox may need more time to be accessible",
        {
          error: verificationError instanceof Error ? verificationError.message : "Unknown error",
        },
      );
      deploymentLogger.markReady(visualizationId);
    }
  }

  private handleCreationError(error: unknown, sandboxId: string, visualizationId?: string): void {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create sandbox visualization:", errorMessage, {
      sandboxId,
      visualizationId,
      deployTokenConfigured: !!this.deployToken,
      activeSandboxCount: this.activeSandboxes.size,
      originalError: error,
    });

    if (visualizationId) {
      deploymentLogger.markFailed(
        visualizationId,
        `Sandbox creation failed: ${errorMessage}`,
        { sandboxId, error },
      );
    }

    throw new Error(`Failed to create sandbox visualization (ID: ${sandboxId}): ${errorMessage}`);
  }

  /**
   * Verify that a deployed sandbox is accessible and responding
   */
  private async verifyDeployment(url: string, visualizationId?: string): Promise<void> {
    const maxRetries = CONFIG.RETRY.MAX_ATTEMPTS;
    const retryDelay = CONFIG.RETRY.DELAY_MS;

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
          signal: AbortSignal.timeout(CONFIG.RETRY.TIMEOUT_MS),
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
          console.error("Sandbox verification failed after all attempts:", errorMessage, {
            url,
            maxRetries,
            finalAttempt: attempt,
            originalError: error,
          });
          throw new Error(`Verification failed after ${maxRetries} attempts: ${errorMessage}`);
        } else {
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
   * Makes an HTTP request to a sandbox visualization using its public URL
   */
  async fetchFromSandbox(id: string, path = "/"): Promise<Response> {
    const visualization = this.activeSandboxes.get(id);
    if (!visualization) {
      throw new Error(`Sandbox ${id} not found`);
    }

    try {
      // Use the public URL instead of runtime.fetch with localhost
      const url = new URL(path, visualization.url);
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(CONFIG.RETRY.TIMEOUT_MS),
      });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to fetch from sandbox ${id}:`, errorMessage, {
        sandboxId: id,
        path,
        sandboxUrl: visualization.url,
        originalError: error,
      });
      throw new Error(`Sandbox request failed (ID: ${id}, path: ${path}): ${errorMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to destroy sandbox ${id}:`, errorMessage, {
        sandboxId: id,
        originalError: error,
      });
    }
  }

  /**
   * Cleanup old sandboxes (older than 1 hour)
   */
  async cleanupOldSandboxes(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - CONFIG.CLEANUP.OLD_SANDBOX_THRESHOLD_MS);
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
   * Check if the sandbox service is properly configured
   */
  isConfigured(): boolean {
    return !!this.deployToken;
  }
}

// Export a singleton instance
export const sandboxService = new SandboxService();

// Export types for use in other files
export type { SandboxVisualization, VisualizationRequest };
