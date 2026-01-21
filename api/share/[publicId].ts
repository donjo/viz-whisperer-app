/// <reference lib="deno.ns" />
/**
 * Public Share Endpoint
 *
 * GET /api/share/[publicId] - Get a shared visualization (no auth required)
 */

import { getVisualizationByPublicId } from "../../src/lib/kv.ts";

/**
 * Extract public ID from URL path
 * Expects: /api/share/[publicId]
 */
function extractPublicId(url: URL): string | null {
  const match = url.pathname.match(/^\/api\/share\/([^/]+)$/);
  return match ? match[1] : null;
}

export default async function handler(req: Request): Promise<Response> {
  // Only allow GET requests
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(req.url);
  const publicId = extractPublicId(url);

  if (!publicId) {
    return Response.json({ error: "Public ID is required" }, { status: 400 });
  }

  try {
    const visualization = await getVisualizationByPublicId(publicId);

    if (!visualization) {
      return Response.json({ error: "Visualization not found" }, { status: 404 });
    }

    // Return visualization (excluding userId for privacy)
    return Response.json({
      visualization: {
        id: visualization.id,
        title: visualization.title,
        prompt: visualization.prompt,
        dataSourceUrl: visualization.dataSourceUrl,
        html: visualization.html,
        createdAt: visualization.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to get shared visualization:", error);
    return Response.json(
      { error: "Failed to get visualization" },
      { status: 500 },
    );
  }
}
