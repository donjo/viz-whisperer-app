/// <reference lib="deno.ns" />
/**
 * OAuth Callback Endpoint
 *
 * GET /api/auth/callback
 *
 * This is where WorkOS redirects the user after they sign in.
 * We exchange the authorization code for user information,
 * create/update the user in our database, and set a session cookie.
 */

import { authenticateWithCode, createSessionCookie, ensureUserInKv } from "../../src/lib/auth.ts";

export default async function handler(req: Request): Promise<Response> {
  // Only allow GET requests (OAuth callbacks are GET)
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // This is the returnTo URL we passed
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Get the correct origin for redirects (same logic as login.ts)
  const appUrl = Deno.env.get("APP_URL");
  let origin: string;
  if (appUrl) {
    origin = appUrl.replace(/\/$/, "");
  } else if (
    Deno.env.get("DENO_ENV") === "development" ||
    !Deno.env.get("DENO_DEPLOYMENT_ID") // Not on Deno Deploy = local dev
  ) {
    origin = "http://localhost:5800";
  } else {
    origin = url.origin;
  }

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    // Redirect to home with error message
    return Response.redirect(
      `${origin}/?error=${encodeURIComponent(errorDescription || error)}`,
      302,
    );
  }

  // Validate that we got a code
  if (!code) {
    console.error("No authorization code in callback");
    return Response.redirect(`${origin}/?error=no_code`, 302);
  }

  try {
    // Exchange the code for user information
    const { userId, email, name, avatarUrl } = await authenticateWithCode(code);

    // Create or update the user in our database
    await ensureUserInKv(userId, email, name, avatarUrl);

    // Create a session cookie
    const sessionCookie = await createSessionCookie(userId, email, name, avatarUrl);

    // Determine where to redirect the user
    // The state parameter contains the original returnTo URL
    const returnTo = state || "/";

    // Redirect to the app with the session cookie set
    return new Response(null, {
      status: 302,
      headers: {
        Location: returnTo,
        "Set-Cookie": sessionCookie,
      },
    });
  } catch (err) {
    console.error("Authentication callback error:", err);

    // Check for specific error types
    const errorMessage = err instanceof Error ? err.message : "Authentication failed";

    return Response.redirect(
      `${origin}/?error=${encodeURIComponent(errorMessage)}`,
      302,
    );
  }
}
