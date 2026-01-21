// Test sandbox with Anthropic SDK
import { Sandbox } from "@deno/sandbox";

const CODE_WITH_ANTHROPIC = `
import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

console.log("Sandbox started!");
console.log("ANTHROPIC_API_KEY set:", !!Deno.env.get("ANTHROPIC_API_KEY"));

let anthropic;
try {
  anthropic = new Anthropic();
  console.log("Anthropic client created!");
} catch (error) {
  console.error("Failed to create Anthropic client:", error);
}

Deno.serve((req) => {
  return new Response("Anthropic SDK loaded successfully!", {
    headers: { "Content-Type": "text/plain" }
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

  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create({
    token,
    baseUrl: "http://localhost:8000",
    env: {
      ANTHROPIC_API_KEY: apiKey || "test-key",
    },
  });

  console.log("Writing code to sandbox...");
  const encoder = new TextEncoder();
  await sandbox.fs.writeFile("/app/server.ts", encoder.encode(CODE_WITH_ANTHROPIC));

  console.log("Running code in sandbox...");
  const process = await sandbox.deno.run({
    entrypoint: "/app/server.ts",
  });

  console.log("Exposing HTTP...");
  const url = await sandbox.exposeHttp({ pid: process.pid });
  console.log("Sandbox URL:", url);

  // Wait a bit for the server to start and npm packages to install
  console.log("Waiting for sandbox to initialize (npm packages)...");
  await new Promise(r => setTimeout(r, 10000));

  // Test the endpoint
  console.log("Testing endpoint...");
  try {
    const response = await fetch(url);
    console.log("Response status:", response.status);
    const text = await response.text();
    console.log("Response body:", text);
  } catch (error) {
    console.error("Fetch error:", error);
  }

  // Cleanup
  await process.kill();
  await sandbox[Symbol.asyncDispose]();
  console.log("Done!");
}

main().catch(console.error);
