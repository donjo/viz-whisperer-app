// Test full generator code
import { Sandbox } from "@deno/sandbox";

// Simplified version of the generator code
const GENERATOR_CODE = `
import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

const requestJson = Deno.args[0];
console.log("Starting visualization generator...");
console.log("ANTHROPIC_API_KEY set:", !!Deno.env.get("ANTHROPIC_API_KEY"));
console.log("requestJson:", requestJson?.substring(0, 100));

if (!requestJson) {
  console.error("No request data provided");
  Deno.exit(1);
}

let request;
try {
  request = JSON.parse(requestJson);
  console.log("Request parsed successfully, prompt:", request.prompt?.substring(0, 50));
} catch (error) {
  console.error("Failed to parse request JSON:", error);
  Deno.exit(1);
}

let anthropic;
try {
  anthropic = new Anthropic();
  console.log("Anthropic client created successfully");
} catch (error) {
  console.error("Failed to create Anthropic client:", error);
  throw error;
}

// Skip actual API call for this test
const generatedHtml = "<html><body><h1>Test Visualization</h1></body></html>";

Deno.serve((req) => {
  const url = new URL(req.url);
  console.log("Request to:", url.pathname);

  if (url.pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  return new Response(generatedHtml, {
    headers: { "Content-Type": "text/html" }
  });
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
      url: "https://example.com/api",
      data: [{ name: "test", value: 100 }],
      structure: {
        fields: [{ name: "name", type: "string", sample: "test" }],
        totalRecords: 1
      }
    },
    prompt: "Create a simple bar chart"
  };

  // Inject request data into code
  const requestData = JSON.stringify(request);
  const codeWithRequest = GENERATOR_CODE.replace(
    "const requestJson = Deno.args[0];",
    `const requestJson = ${JSON.stringify(requestData)};`,
  );

  console.log("=== Generated code preview ===");
  console.log(codeWithRequest.substring(0, 500));
  console.log("...");
  console.log("=== End preview ===\n");

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

  // Wait for initialization
  console.log("Waiting for sandbox to initialize...");
  await new Promise(r => setTimeout(r, 5000));

  // Test the endpoint
  console.log("Testing endpoint...");
  try {
    const response = await fetch(url);
    console.log("Response status:", response.status);
    if (response.ok) {
      const text = await response.text();
      console.log("Response body:", text.substring(0, 200));
    } else {
      console.log("Response text:", await response.text());
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }

  // Also test health endpoint
  console.log("\nTesting health endpoint...");
  try {
    const healthResponse = await fetch(`${url}/health`);
    console.log("Health status:", healthResponse.status);
    console.log("Health body:", await healthResponse.text());
  } catch (error) {
    console.error("Health fetch error:", error);
  }

  // Cleanup
  await process.kill();
  await sandbox[Symbol.asyncDispose]();
  console.log("\nDone!");
}

main().catch(console.error);
