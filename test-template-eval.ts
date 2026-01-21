// Test by dynamically importing and using the actual evaluated value
import { Sandbox } from "@deno/sandbox";

// Copy just the template literal definition (this will be evaluated by JavaScript)
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

const requestJson = Deno.args[0];
console.log("Starting visualization generator...");
console.log("ANTHROPIC_API_KEY set:", !!Deno.env.get("ANTHROPIC_API_KEY"));

if (!requestJson) {
  console.error("No request data provided");
  Deno.exit(1);
}

let request: VisualizationRequest;
try {
  request = JSON.parse(requestJson);
  console.log("Request parsed successfully, prompt:", request.prompt?.substring(0, 50));
} catch (error) {
  console.error("Failed to parse request JSON:", error);
  Deno.exit(1);
}

let anthropic: Anthropic;
try {
  anthropic = new Anthropic();
  console.log("Anthropic client created successfully");
} catch (error) {
  console.error("Failed to create Anthropic client:", error);
  throw error;
}

const systemPrompt = \`Generate a simple HTML/CSS/JavaScript chart visualization. Return ONLY valid JSON:

{
  "html": "<div id='chart'></div>",
  "css": "body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}#chart{width:100%;height:100vh;padding:20px}",
  "javascript": "WORKING_CHART_CODE"
}

REQUIREMENTS:
1. Use vanilla JavaScript and HTML5 Canvas or SVG for charts
2. NO external libraries - create charts from scratch
3. Dark theme: background #0f0f23, text #e2e8f0, bars #60a5fa
4. Make it responsive and interactive
5. Include hover effects and labels
6. Transform the provided data into a working visualization
7. Use canvas.getContext('2d') for drawing

Create a complete working chart using only native browser APIs.\`;

function generateFallbackChart(): GeneratedCode {
  return {
    html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
    css: \`body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}
#chart{width:100%;height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}
canvas{max-width:100%;max-height:100%;background:rgba(30,30,60,0.3);border-radius:8px}\`,
    javascript: \`
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const data = [{ name: 'A', value: 400 }, { name: 'B', value: 300 }];
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#60a5fa';
  data.forEach((d, i) => ctx.fillRect(50 + i * 100, 200 - d.value/2, 60, d.value/2));
}
canvas.width = 400; canvas.height = 300;
draw();
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

let generatedHtml: string;
let generationError: string | null = null;

// Skip API call, use fallback for testing
const fallback = generateFallbackChart();
generatedHtml = buildHtml(fallback);
console.log("Using fallback chart for test");

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  if (url.pathname === "/health") {
    return Response.json({ status: generationError ? "error" : "ok", error: generationError });
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(generatedHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
  return new Response("Not Found", { status: 404 });
});
`;

async function main() {
  const token = Deno.env.get("DENO_DEPLOY_DEV_TOKEN");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!token) {
    console.error("DENO_DEPLOY_DEV_TOKEN not set");
    Deno.exit(1);
  }

  // Test request
  const request = {
    apiData: {
      url: "https://api.example.com",
      data: [{ name: "Item 1", value: 100 }],
      structure: {
        fields: [{ name: "name", type: "string", sample: "Item 1" }],
        totalRecords: 1
      }
    },
    prompt: "Create a simple bar chart"
  };

  // Inject request data
  const requestData = JSON.stringify(request);
  const codeWithRequest = VISUALIZATION_GENERATOR_CODE.replace(
    "const requestJson = Deno.args[0];",
    `const requestJson = ${JSON.stringify(requestData)};`,
  );

  // Write to file for inspection
  await Deno.writeTextFile("test-generated-code2.ts", codeWithRequest);
  console.log("Code written to test-generated-code2.ts\n");

  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create({
    token,
    baseUrl: "http://localhost:8000",
    env: {
      ANTHROPIC_API_KEY: apiKey || "test-key",
      MODEL: "claude-sonnet-4-5-20250929",
    },
  });

  console.log("Writing code to sandbox...");
  const encoder = new TextEncoder();
  await sandbox.fs.writeFile("/app/generator.ts", encoder.encode(codeWithRequest));

  console.log("Running code in sandbox...");
  const process = await sandbox.deno.run({
    entrypoint: "/app/generator.ts",
  });

  console.log("Exposing HTTP...");
  const url = await sandbox.exposeHttp({ pid: process.pid });
  console.log("Sandbox URL:", url);

  await new Promise(r => setTimeout(r, 5000));

  console.log("\nTesting endpoint...");
  try {
    const response = await fetch(url);
    console.log("Response status:", response.status);
    if (response.ok) {
      const text = await response.text();
      console.log("Response preview:", text.substring(0, 300));
    } else {
      console.log("Error body:", await response.text());
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }

  console.log("\nTesting health...");
  try {
    const healthResponse = await fetch(`${url}/health`);
    console.log("Health status:", healthResponse.status);
    console.log("Health body:", await healthResponse.text());
  } catch (error) {
    console.error("Health error:", error);
  }

  await process.kill();
  await sandbox[Symbol.asyncDispose]();
  console.log("\nDone!");
}

main().catch(console.error);
