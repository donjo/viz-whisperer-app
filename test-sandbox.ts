// Test minimal sandbox functionality
import { Sandbox } from "@deno/sandbox";

const SIMPLE_CODE = `
console.log("Sandbox started!");

Deno.serve((req) => {
  console.log("Request received:", req.url);
  return new Response("Hello from sandbox!", {
    headers: { "Content-Type": "text/plain" }
  });
});
`;

async function main() {
  const token = Deno.env.get("DENO_DEPLOY_DEV_TOKEN");
  if (!token) {
    console.error("DENO_DEPLOY_DEV_TOKEN not set");
    Deno.exit(1);
  }

  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create({
    token,
    baseUrl: "http://localhost:8000",
  });

  console.log("Writing code to sandbox...");
  const encoder = new TextEncoder();
  await sandbox.fs.writeFile("/app/server.ts", encoder.encode(SIMPLE_CODE));

  console.log("Running code in sandbox...");
  const process = await sandbox.deno.run({
    entrypoint: "/app/server.ts",
  });

  console.log("Exposing HTTP...");
  const url = await sandbox.exposeHttp({ pid: process.pid });
  console.log("Sandbox URL:", url);

  // Wait a bit for the server to start
  await new Promise(r => setTimeout(r, 2000));

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
