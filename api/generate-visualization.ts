/// <reference lib="deno.ns" />
/**
 * Generate Visualization Endpoint
 *
 * POST /api/generate-visualization
 *
 * For authenticated users: API key is fetched from KV (encrypted storage)
 * For unauthenticated users: API key must be provided in request body
 */

import { sandboxService } from "../src/services/sandboxService.ts";
import { deploymentLogger } from "../src/services/deploymentLogger.ts";
import { getCurrentUser } from "../src/lib/auth.ts";
import { decrypt } from "../src/lib/encryption.ts";

interface VisualizationRequest {
  apiData: {
    url: string;
    data: any;
    structure: {
      fields: Array<{
        name: string;
        type: string;
        sample: any;
      }>;
      totalRecords: number;
    };
  };
  prompt: string;
  apiKey?: string; // Optional if user has stored key
  currentCode?: {
    html: string;
    css: string;
    javascript: string;
  };
}

interface GeneratedCode {
  sandboxUrl: string;
  sandboxId: string;
  visualizationId: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let visualizationId: string | undefined;

  try {
    // Parse request body
    let requestData: VisualizationRequest;
    try {
      requestData = await req.json();
    } catch {
      return Response.json({
        error: "Invalid JSON in request body",
      }, { status: 400 });
    }

    // Validate required fields
    if (!requestData.apiData) {
      return Response.json({
        error: "API data is required",
      }, { status: 400 });
    }

    if (!requestData.prompt) {
      return Response.json({
        error: "Prompt is required",
      }, { status: 400 });
    }

    // Determine the API key to use
    let apiKey = requestData.apiKey;

    // If no API key in request, try to get it from the authenticated user
    if (!apiKey) {
      const user = await getCurrentUser(req);

      if (user && user.encryptedApiKey) {
        // Decrypt the stored API key
        try {
          apiKey = await decrypt(user.encryptedApiKey);
        } catch (decryptError) {
          console.error("Failed to decrypt API key:", decryptError);
          return Response.json({
            error: "Failed to decrypt stored API key. Please re-save your API key in settings.",
          }, { status: 500 });
        }
      } else if (user && !user.encryptedApiKey) {
        // User is authenticated but hasn't set an API key
        return Response.json({
          error: "No API key configured. Please set your Anthropic API key in settings.",
        }, { status: 400 });
      } else {
        // Not authenticated and no API key provided
        return Response.json({
          error: "API key is required. Please sign in or provide an API key.",
        }, { status: 401 });
      }
    }

    // Final validation that we have an API key
    if (!apiKey || apiKey.trim() === "") {
      return Response.json({
        error: "API key is required.",
      }, { status: 400 });
    }

    // Start deployment logging
    visualizationId = crypto.randomUUID();
    deploymentLogger.startDeployment(visualizationId);

    deploymentLogger.logEvent(
      visualizationId,
      "generation",
      "Creating sandbox with API key (key is securely injected via secrets)",
    );

    // Create the sandbox - returns immediately with URL
    // The sandbox serves a loading UI while the AI generates the visualization
    const result = await sandboxService.createVisualization(
      {
        apiData: requestData.apiData,
        prompt: requestData.prompt,
        currentCode: requestData.currentCode,
      },
      apiKey,
      visualizationId,
    );

    const response: GeneratedCode = {
      sandboxUrl: result.url,
      sandboxId: result.id,
      visualizationId,
    };

    console.log(`Created sandbox ${result.id} at ${result.url}`);

    return Response.json(response);
  } catch (error) {
    console.error("Error generating visualization:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to generate visualization";

    // Check for common API key errors and provide helpful messages
    let userFriendlyError = errorMessage;
    if (
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("invalid_api_key")
    ) {
      userFriendlyError = "Invalid API key. Please check your Anthropic API key and try again.";
    } else if (errorMessage.includes("rate") || errorMessage.includes("429")) {
      userFriendlyError = "Rate limit exceeded. Please wait a moment and try again.";
    } else if (errorMessage.includes("insufficient") || errorMessage.includes("credit")) {
      userFriendlyError =
        "Insufficient credits on your Anthropic account. Please check your account balance.";
    }

    // Try to log the error if we have a visualization ID
    try {
      if (typeof visualizationId !== "undefined") {
        deploymentLogger.markFailed(visualizationId, userFriendlyError, error);
      }
    } catch (logError) {
      console.error("Failed to log deployment error:", logError);
    }

    return Response.json({
      error: userFriendlyError,
    }, { status: 500 });
  }
}
