// Test with actual API call
import { Sandbox } from "@deno/sandbox";

const VISUALIZATION_GENERATOR_CODE = `
import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

interface VisualizationRequest {
  apiData: { url: string; data: any[]; structure: { fields: any[]; totalRecords: number } };
  prompt: string;
}

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

const requestJson = Deno.args[0];
console.log("Starting visualization generator...");
console.log("ANTHROPIC_API_KEY:", Deno.env.get("ANTHROPIC_API_KEY")?.substring(0, 10) + "...");

if (!requestJson) {
  console.error("No request data provided");
  Deno.exit(1);
}

let request: VisualizationRequest;
try {
  request = JSON.parse(requestJson);
  console.log("Request parsed, prompt:", request.prompt);
} catch (error) {
  console.error("Failed to parse request JSON:", error);
  Deno.exit(1);
}

function generateFallbackChart(): GeneratedCode {
  return {
    html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
    css: 'body{background:#0f0f23;color:#e2e8f0;margin:0}#chart{width:100%;height:100vh;padding:20px}',
    javascript: 'const c=document.getElementById("chartCanvas");c.width=400;c.height=300;const x=c.getContext("2d");x.fillStyle="#60a5fa";x.fillRect(50,100,100,150);x.fillRect(200,50,100,200);'
  };
}

function buildHtml(code: GeneratedCode): string {
  return \`<!DOCTYPE html><html><head><style>\${code.css}</style></head><body>\${code.html}<script>\${code.javascript}</script></body></html>\`;
}

let generatedHtml: string;
let generationError: string | null = null;

try {
  console.log("Creating Anthropic client...");
  const anthropic = new Anthropic();
  console.log("Client created, calling API...");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: "Return this JSON exactly: {\\\"html\\\":\\\"<h1>Test</h1>\\\",\\\"css\\\":\\\"body{background:#0f0f23;color:white}\\\",\\\"javascript\\\":\\\"console.log('test')\\\"}" }]
  });

  console.log("API response received");
  const content = response.content[0];
  if (content.type === "text") {
    try {
      const code = JSON.parse(content.text);
      generatedHtml = buildHtml(code);
      console.log("Generated HTML from API response");
    } catch {
      console.log("Failed to parse API response, using fallback");
      generatedHtml = buildHtml(generateFallbackChart());
    }
  } else {
    throw new Error("Unexpected response format");
  }
} catch (error) {
  console.error("API call failed:", error);
  generationError = error instanceof Error ? error.message : "Unknown error";
  generatedHtml = buildHtml(generateFallbackChart());
  console.log("Using fallback chart due to error");
}

console.log("Starting HTTP server...");

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  console.log("Request:", req.method, url.pathname);

  if (url.pathname === "/health") {
    return Response.json({ status: generationError ? "error" : "ok", error: generationError });
  }
  return new Response(generatedHtml, { headers: { "Content-Type": "text/html" } });
});
`;

async function main() {
  const token = Deno.env.get("DENO_DEPLOY_DEV_TOKEN");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!token || !apiKey) {
    console.error("Missing required env vars");
    Deno.exit(1);
  }

  const request = {
    apiData: { url: "https://example.com", data: [], structure: { fields: [], totalRecords: 0 } },
    prompt: "Create a test chart"
  };

  const requestData = JSON.stringify(request);
  const codeWithRequest = VISUALIZATION_GENERATOR_CODE.replace(
    "const requestJson = Deno.args[0];",
    `const requestJson = ${JSON.stringify(requestData)};`,
  );

  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create({
    token,
    baseUrl: "http://localhost:8000",
    env: {
      ANTHROPIC_API_KEY: apiKey,
    },
  });

  console.log("Writing and running code...");
  const encoder = new TextEncoder();
  await sandbox.fs.writeFile("/app/generator.ts", encoder.encode(codeWithRequest));

  const process = await sandbox.deno.run({
    entrypoint: "/app/generator.ts",
  });

  const url = await sandbox.exposeHttp({ pid: process.pid });
  console.log("Sandbox URL:", url);

  // Wait for API call
  console.log("Waiting 30 seconds for API call...");
  await new Promise(r => setTimeout(r, 30000));

  console.log("\nTesting endpoint...");
  try {
    const response = await fetch(url);
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.substring(0, 200));
  } catch (error) {
    console.error("Error:", error);
  }

  console.log("\nTesting health...");
  try {
    const health = await fetch(`${url}/health`);
    console.log("Health:", await health.text());
  } catch (error) {
    console.error("Health error:", error);
  }

  await process.kill();
  await sandbox[Symbol.asyncDispose]();
  console.log("\nDone!");
}

main().catch(console.error);
