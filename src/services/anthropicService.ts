// Configuration constants
const CONFIG = {
  API: {
    ENDPOINT: "/api/generate-visualization",
  },
} as const;

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
  apiKey: string; // User's Anthropic API key
  currentCode?: {
    html: string;
    css: string;
    javascript: string;
  };
}

interface GeneratedCode {
  sandboxUrl?: string;
  sandboxId?: string;
  visualizationId?: string;
  // Legacy fields for local code (not used in sandbox mode)
  html?: string;
  css?: string;
  javascript?: string;
  fullCode?: string;
}

class AnthropicService {
  constructor() {
    console.log("AnthropicService: Using backend API with user-provided API keys");
  }

  /**
   * Always returns true since the service is ready to use
   * Actual API key validation happens when making requests
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Generate a visualization by sending the request to the backend
   * The backend creates a sandbox that calls Anthropic API directly
   *
   * @param request - The visualization request including user's API key
   */
  async generateVisualization(request: VisualizationRequest): Promise<GeneratedCode> {
    // Validate API key before making request
    if (!request.apiKey || request.apiKey.trim() === "") {
      throw new Error("API key is required. Please enter your Anthropic API key.");
    }

    try {
      const response = await fetch(CONFIG.API.ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const contentType = response.headers.get("content-type") || "";
      const isJsonResponse = contentType.includes("application/json");

      if (!response.ok) {
        if (isJsonResponse) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate visualization");
        } else {
          const errorText = await response.text();
          throw new Error(`Server error (${response.status}): ${errorText}`);
        }
      }

      if (!isJsonResponse) {
        const responseText = await response.text();
        throw new Error(
          `Expected JSON response but got ${contentType || "unknown content type"}: ${
            responseText.slice(0, 100)
          }`,
        );
      }

      const result: GeneratedCode = await response.json();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Backend API error:", errorMessage, {
        url: CONFIG.API.ENDPOINT,
        method: "POST",
        originalError: error,
      });
      throw new Error(`Failed to generate visualization: ${errorMessage}`);
    }
  }
}

export const anthropicService = new AnthropicService();
