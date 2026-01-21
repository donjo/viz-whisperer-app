/// <reference lib="deno.ns" />
import { sandboxService } from "../src/services/sandboxService.ts";
import { deploymentLogger } from "../src/services/deploymentLogger.ts";

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
  apiKey: string; // User provides their own Anthropic API key
  currentCode?: {
    html: string;
    css: string;
    javascript: string;
  };
}

interface GeneratedCode {
  html?: string;
  sandboxId?: string;
  visualizationId?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let visualizationId: string | undefined;

  try {
    let requestData: VisualizationRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return Response.json({
        error: "Invalid JSON in request body",
      }, { status: 400 });
    }

    // Validate required fields
    if (!requestData.apiKey) {
      return Response.json({
        error: "API key is required. Please enter your Anthropic API key.",
      }, { status: 400 });
    }

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

    // Start deployment logging
    visualizationId = crypto.randomUUID();
    deploymentLogger.startDeployment(visualizationId);

    deploymentLogger.logEvent(
      visualizationId,
      "generation",
      "Creating sandbox with user's API key (key is securely injected via secrets)",
    );

    // Create the sandbox and wait for HTML generation
    // The sandbox makes Anthropic API calls directly using the securely injected key
    const sandboxPromise = sandboxService.createAndFetchVisualization(
      {
        apiData: requestData.apiData,
        prompt: requestData.prompt,
        currentCode: requestData.currentCode,
      },
      requestData.apiKey, // User's API key - injected securely via sandbox secrets
      visualizationId,
    );

    // Add a timeout to prevent the request from hanging indefinitely
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Visualization generation timeout after 120 seconds")),
        120000,
      );
    });

    const result = await Promise.race([sandboxPromise, timeoutPromise]);

    const response: GeneratedCode = {
      html: result.html,
      sandboxId: result.id,
      visualizationId,
    };

    console.log(`Generated visualization ${result.id}, HTML length: ${result.html.length}`);
    deploymentLogger.markReady(visualizationId);

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
