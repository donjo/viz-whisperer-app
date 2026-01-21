/// <reference lib="deno.ns" />
/**
 * Current User Endpoint
 *
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's information.
 * Used by the frontend to check authentication status and display user info.
 */

import { getCurrentUser } from "../../src/lib/auth.ts";

export default async function handler(req: Request): Promise<Response> {
  // Only allow GET requests
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const user = await getCurrentUser(req);

    if (!user) {
      // Not authenticated - return 401
      return Response.json(
        { authenticated: false },
        { status: 401 },
      );
    }

    // Return user info (excluding sensitive data like encrypted API key)
    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        // Include whether they have an API key set (but not the key itself)
        hasApiKey: !!user.encryptedApiKey,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    return Response.json(
      { error: "Failed to get user info" },
      { status: 500 },
    );
  }
}
