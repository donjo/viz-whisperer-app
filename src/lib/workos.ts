/// <reference lib="deno.ns" />
/**
 * WorkOS Client Configuration
 *
 * This file sets up the WorkOS client for authentication.
 * WorkOS handles the OAuth flow with GitHub (or other providers).
 *
 * Environment variables needed:
 * - WORKOS_API_KEY: Your WorkOS API key (starts with sk_)
 * - WORKOS_CLIENT_ID: Your WorkOS client ID (starts with client_)
 */

import { WorkOS } from "npm:@workos-inc/node@8.0.0";

// Create a single WorkOS client instance that's reused across the app
// The SDK reads WORKOS_API_KEY from environment automatically
const workosApiKey = Deno.env.get("WORKOS_API_KEY");

if (!workosApiKey) {
  console.warn(
    "WORKOS_API_KEY not configured - authentication will not work. " +
      "Get your API key from https://dashboard.workos.com",
  );
}

export const workos = new WorkOS(workosApiKey);

// Export the client ID for use in auth flows
export const workosClientId = Deno.env.get("WORKOS_CLIENT_ID") || "";

if (!workosClientId) {
  console.warn(
    "WORKOS_CLIENT_ID not configured - authentication will not work. " +
      "Get your client ID from https://dashboard.workos.com",
  );
}

/**
 * Check if WorkOS is properly configured
 * This is useful for showing appropriate UI when auth isn't set up
 */
export function isWorkOSConfigured(): boolean {
  return !!workosApiKey && !!workosClientId;
}
