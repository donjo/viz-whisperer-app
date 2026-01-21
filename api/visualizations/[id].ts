/// <reference lib="deno.ns" />
/**
 * Single Visualization Endpoint
 *
 * GET /api/visualizations/[id] - Get a single visualization
 * DELETE /api/visualizations/[id] - Delete a visualization
 */

import { requireAuth } from "../../src/lib/auth.ts";
import { deleteVisualization, getVisualization } from "../../src/lib/kv.ts";

/**
 * Extract visualization ID from URL path
 * Expects: /api/visualizations/[id]
 */
function extractId(url: URL): string | null {
  const match = url.pathname.match(/^\/api\/visualizations\/([^/]+)$/);
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
    case "GET":
      return handleGet(vizId, user.id);
    case "DELETE":
      return handleDelete(vizId, user.id);
    default:
      return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}

/**
 * GET - Get a single visualization
 */
async function handleGet(vizId: string, userId: string): Promise<Response> {
  try {
    const visualization = await getVisualization(vizId);

    if (!visualization) {
      return Response.json({ error: "Visualization not found" }, { status: 404 });
    }

    // Check ownership
    if (visualization.userId !== userId) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    return Response.json({ visualization });
  } catch (error) {
    console.error("Failed to get visualization:", error);
    return Response.json(
      { error: "Failed to get visualization" },
      { status: 500 },
    );
  }
}

/**
 * DELETE - Delete a visualization
 */
async function handleDelete(vizId: string, userId: string): Promise<Response> {
  try {
    const visualization = await getVisualization(vizId);

    if (!visualization) {
      return Response.json({ error: "Visualization not found" }, { status: 404 });
    }

    // Check ownership
    if (visualization.userId !== userId) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    await deleteVisualization(vizId, userId);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete visualization:", error);
    return Response.json(
      { error: "Failed to delete visualization" },
      { status: 500 },
    );
  }
}
