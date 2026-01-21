/// <reference lib="deno.ns" />
/**
 * Visualization Share Endpoint
 *
 * POST /api/visualizations/[id]/share - Create a public share link
 * DELETE /api/visualizations/[id]/share - Revoke the share link
 */

import { requireAuth } from "../../../src/lib/auth.ts";
import { createShareLink, getVisualization, removeShareLink } from "../../../src/lib/kv.ts";

/**
 * Extract visualization ID from URL path
 * Expects: /api/visualizations/[id]/share
 */
function extractId(url: URL): string | null {
  const match = url.pathname.match(/^\/api\/visualizations\/([^/]+)\/share$/);
  return match ? match[1] : null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const vizId = extractId(url);

  if (!vizId) {
    return Response.json({ error: "Visualization ID is required" }, { status: 400 });
  }

  // All endpoints require authentication
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) {
    return authResult; // 401 Unauthorized
  }
  const user = authResult;

  switch (req.method) {
    case "POST":
      return handleShare(vizId, user.id);
    case "DELETE":
      return handleUnshare(vizId, user.id);
    default:
      return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}

/**
 * POST - Create a public share link
 */
async function handleShare(vizId: string, userId: string): Promise<Response> {
  try {
    // Verify ownership first
    const visualization = await getVisualization(vizId);
    if (!visualization) {
      return Response.json({ error: "Visualization not found" }, { status: 404 });
    }
    if (visualization.userId !== userId) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const publicId = await createShareLink(vizId, userId);

    return Response.json({
      success: true,
      publicId,
    });
  } catch (error) {
    console.error("Failed to create share link:", error);
    return Response.json(
      { error: "Failed to create share link" },
      { status: 500 },
    );
  }
}

/**
 * DELETE - Revoke the share link
 */
async function handleUnshare(vizId: string, userId: string): Promise<Response> {
  try {
    // Verify ownership first
    const visualization = await getVisualization(vizId);
    if (!visualization) {
      return Response.json({ error: "Visualization not found" }, { status: 404 });
    }
    if (visualization.userId !== userId) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    await removeShareLink(vizId, userId);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to remove share link:", error);
    return Response.json(
      { error: "Failed to remove share link" },
      { status: 500 },
    );
  }
}
