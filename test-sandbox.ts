#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test script to independently query a Deno Deploy Sandbox
 * Usage: deno run --allow-net --allow-env test-sandbox.ts
 */

// The sandbox ID from the URL shown in your screenshot
const SANDBOX_ID = "08540b2411964a18ae21de057c51ae17";
const SANDBOX_URL = `https://${SANDBOX_ID}.sandbox.deno.net`;

console.log("🔍 Testing Deno Deploy Sandbox");
console.log("================================");
console.log(`Sandbox ID: ${SANDBOX_ID}`);
console.log(`Sandbox URL: ${SANDBOX_URL}`);
console.log("");

async function testEndpoint(path: string) {
  const url = `${SANDBOX_URL}${path}`;
  console.log(`\n📡 Testing: ${url}`);
  console.log("-".repeat(50));
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Deno Sandbox Test Script",
        "Accept": "text/html,application/json,*/*"
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Headers:`);
    for (const [key, value] of response.headers) {
      console.log(`   ${key}: ${value}`);
    }
    
    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    
    if (contentLength && parseInt(contentLength) > 0) {
      const body = await response.text();
      console.log(`\n📄 Body (first 500 chars):`);
      console.log(body.substring(0, 500));
      if (body.length > 500) {
        console.log("... [truncated]");
      }
      console.log(`\n📊 Total body length: ${body.length} characters`);
    } else {
      console.log("\n⚠️ No body content or content-length is 0");
    }
    
    return response;
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.log("💡 This might indicate the sandbox is not accessible or doesn't exist");
    }
    return null;
  }
}

async function checkSandboxAPI() {
  // Check if we have a DENO_DEPLOY_TOKEN to make authenticated requests
  const token = Deno.env.get("DENO_DEPLOY_TOKEN");
  if (token) {
    console.log("\n🔑 DENO_DEPLOY_TOKEN found - attempting authenticated API check");
    
    try {
      // Note: This is speculative - the actual Deno Deploy API endpoint might be different
      const apiResponse = await fetch(`https://api.deno.com/v1/sandboxes/${SANDBOX_ID}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        console.log("📦 Sandbox API Response:", JSON.stringify(data, null, 2));
      } else {
        console.log(`⚠️ API Response: ${apiResponse.status} ${apiResponse.statusText}`);
      }
    } catch (error) {
      console.log(`❌ API Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log("\n⚠️ No DENO_DEPLOY_TOKEN found - skipping authenticated API checks");
  }
}

// Main execution
console.log("\n🚀 Starting sandbox tests...\n");

// Test the main endpoints
await testEndpoint("/");
await testEndpoint("/index.html");
await testEndpoint("/health");  // Test a non-existent endpoint to see 404 behavior
await testEndpoint("/api/status");  // Another test endpoint

// Try authenticated API if available
await checkSandboxAPI();

console.log("\n\n✅ Test complete!");
console.log("================================");

// Also try with curl command for comparison
console.log("\n💡 You can also test with curl:");
console.log(`curl -v "${SANDBOX_URL}"`);
console.log(`curl -v -H "Accept: text/html" "${SANDBOX_URL}/"`);