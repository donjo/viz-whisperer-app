/// <reference lib="deno.ns" />
/**
 * Login Endpoint
 *
 * GET /api/auth/login
 *
 * Redirects the user to WorkOS AuthKit for authentication.
 * After the user signs in with GitHub, WorkOS redirects them
 * back to our callback URL with an authorization code.
 */

import { getAuthorizationUrl } from "../../src/lib/auth.ts";
import { isWorkOSConfigured } from "../../src/lib/workos.ts";

export default function handler(req: Request): Response {
  // Only allow GET requests
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Check if WorkOS is configured
  if (!isWorkOSConfigured()) {
    return Response.json(
      { error: "Authentication is not configured on this server" },
      { status: 503 },
    );
  }

  try {
    // Build the callback URL
    // In development, Vite proxies requests so we need to use the frontend origin
    // APP_URL can be set to override (useful for production)
    const url = new URL(req.url);
    const appUrl = Deno.env.get("APP_URL");

    let origin: string;
    if (appUrl) {
      // Use explicit app URL if configured
      origin = appUrl.replace(/\/$/, ""); // remove trailing slash
    } else if (
      Deno.env.get("DENO_ENV") === "development" ||
      !Deno.env.get("DENO_DEPLOYMENT_ID") // Not on Deno Deploy = local dev
    ) {
      // In dev mode, use Vite's default port
      origin = "http://localhost:5800";
    } else {
      // In production (Deno Deploy), use the request origin
      origin = url.origin;
    }

    const redirectUri = `${origin}/api/auth/callback`;

    // Optional: capture where the user wanted to go (for redirect after login)
    const returnTo = url.searchParams.get("returnTo") || "/";

    // Generate the authorization URL
    // The state parameter lets us pass data through the OAuth flow
    const authUrl = getAuthorizationUrl(redirectUri, returnTo);

    // Redirect the user to WorkOS/GitHub for authentication
    return Response.redirect(authUrl, 302);
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { error: "Failed to start authentication" },
      { status: 500 },
    );
  }
}
