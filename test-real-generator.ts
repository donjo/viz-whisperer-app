// Test with real generator code using actual sandboxService
// NOTE: This imports the module properly so JavaScript evaluates the template literals
//       (Previous version used regex extraction which doesn't process escape sequences)
import { sandboxService } from "./src/services/sandboxService.ts";

async function main() {
  const token = Deno.env.get("DENO_DEPLOY_DEV_TOKEN");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!token) {
    console.error("DENO_DEPLOY_DEV_TOKEN not set");
    Deno.exit(1);
  }

  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    Deno.exit(1);
  }

  // Test request
  const request = {
    apiData: {
      url: "https://api.example.com",
      data: [{ name: "Item 1", value: 100 }, { name: "Item 2", value: 200 }],
      structure: {
        fields: [
          { name: "name", type: "string", sample: "Item 1" },
          { name: "value", type: "number", sample: 100 }
        ],
        totalRecords: 2
      }
    },
    prompt: "Create a simple bar chart"
  };

  console.log("Creating visualization using sandboxService...");
  console.log("This uses the production code path with proper module import.\n");

  try {
    const result = await sandboxService.createVisualization(request, apiKey, "test-viz");
    console.log("\n✓ Sandbox created!");
    console.log("  ID:", result.id);
    console.log("  URL:", result.url);

    // Wait for API call to complete
    console.log("\nWaiting 30 seconds for Anthropic API call...");
    await new Promise(r => setTimeout(r, 30000));

    // Test endpoints
    console.log("\nTesting main endpoint...");
    const response = await fetch(result.url);
    console.log("Response status:", response.status);
    if (response.ok) {
      const text = await response.text();
      console.log("Response length:", text.length);
      console.log("Response preview:", text.substring(0, 300));
    } else {
      console.log("Error response:", await response.text());
    }

    console.log("\nTesting health endpoint...");
    const healthResponse = await fetch(`${result.url}/health`);
    console.log("Health status:", healthResponse.status);
    console.log("Health body:", await healthResponse.text());

    // Cleanup
    await sandboxService.destroySandbox(result.id);
    console.log("\n✓ Done!");
  } catch (error) {
    console.error("\n✗ Failed:", error);
  }
}

main().catch(console.error);
