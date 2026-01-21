/// <reference lib="deno.ns" />
/**
 * Logout Endpoint
 *
 * POST /api/auth/logout
 *
 * Clears the session cookie and logs the user out.
 * Returns a redirect to the home page.
 */

import { createLogoutCookie } from "../../src/lib/auth.ts";

export default function handler(req: Request): Response {
  // Allow both GET and POST for convenience
  // (GET is useful for simple logout links)
  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/";

  // Create a cookie that clears the session
  const logoutCookie = createLogoutCookie();

  // Redirect to home page with the cleared session
  return new Response(null, {
    status: 302,
    headers: {
      Location: returnTo,
      "Set-Cookie": logoutCookie,
    },
  });
}
