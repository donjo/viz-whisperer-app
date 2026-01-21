/// <reference lib="deno.ns" />
/**
 * Visualizations List/Create Endpoint
 *
 * GET /api/visualizations - List user's saved visualizations
 * POST /api/visualizations - Save a new visualization
 */

import { requireAuth } from "../src/lib/auth.ts";
import {
  createVisualization,
  listVisualizationsByUser,
  type Visualization,
} from "../src/lib/kv.ts";

export default async function handler(req: Request): Promise<Response> {
  // All endpoints require authentication
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) {
    return authResult; // 401 Unauthorized
  }
  const user = authResult;

  switch (req.method) {
    case "GET":
      return handleList(user.id);
    case "POST":
      return handleCreate(req, user.id);
    default:
      return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}

/**
 * GET - List user's visualizations
 */
async function handleList(userId: string): Promise<Response> {
  try {
    const visualizations = await listVisualizationsByUser(userId);

    // Return visualizations without the full HTML (to reduce payload size)
    const summaries = visualizations.map((viz) => ({
      id: viz.id,
      title: viz.title,
      prompt: viz.prompt,
      dataSourceUrl: viz.dataSourceUrl,
      publicId: viz.publicId,
      createdAt: viz.createdAt,
      updatedAt: viz.updatedAt,
    }));

    return Response.json({ visualizations: summaries });
  } catch (error) {
    console.error("Failed to list visualizations:", error);
    return Response.json(
      { error: "Failed to list visualizations" },
      { status: 500 },
    );
  }
}

/**
 * POST - Create a new visualization
 */
async function handleCreate(req: Request, userId: string): Promise<Response> {
  // Parse request body
  let body: {
    title?: string;
    prompt?: string;
    dataSourceUrl?: string;
    html?: string;
    sandboxUrl?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields
  if (!body.title || typeof body.title !== "string") {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!body.dataSourceUrl || typeof body.dataSourceUrl !== "string") {
    return Response.json({ error: "Data source URL is required" }, { status: 400 });
  }

  // Get HTML - either provided directly or fetch from sandbox
  let html = body.html;

  if (!html && body.sandboxUrl) {
    // Fetch HTML from sandbox
    try {
      const response = await fetch(body.sandboxUrl, {
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      if (response.ok) {
        html = await response.text();
      } else {
        return Response.json(
          { error: "Failed to fetch visualization from sandbox" },
          { status: 400 },
        );
      }
    } catch (error) {
      console.error("Failed to fetch from sandbox:", error);
      return Response.json(
        { error: "Failed to fetch visualization from sandbox" },
        { status: 400 },
      );
    }
  }

  if (!html) {
    return Response.json(
      { error: "Either html or sandboxUrl is required" },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const visualization: Visualization = {
      id: crypto.randomUUID(),
      userId,
      title: body.title.trim(),
      prompt: body.prompt.trim(),
      dataSourceUrl: body.dataSourceUrl.trim(),
      html,
      createdAt: now,
      updatedAt: now,
    };

    await createVisualization(visualization);

    return Response.json({
      visualization: {
        id: visualization.id,
        title: visualization.title,
        prompt: visualization.prompt,
        dataSourceUrl: visualization.dataSourceUrl,
        createdAt: visualization.createdAt,
        updatedAt: visualization.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to create visualization:", error);
    return Response.json(
      { error: "Failed to save visualization" },
      { status: 500 },
    );
  }
}
