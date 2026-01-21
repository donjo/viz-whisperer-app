import { anthropicService } from "@/services/anthropicService.ts";

interface ApiData {
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
}

interface GeneratedCode {
  html?: string;
  css?: string;
  javascript?: string;
  fullCode?: string;
  sandboxId?: string;
  sandboxUrl?: string;
  visualizationId?: string;
}

export class CodeGenerator {
  /**
   * Generate a new visualization from API data
   *
   * @param apiData - The data to visualize
   * @param prompt - User's visualization request
   * @param apiKey - User's Anthropic API key
   */
  static async generateVisualization(
    apiData: ApiData,
    prompt: string,
    apiKey: string,
  ): Promise<GeneratedCode> {
    // Validate API key
    if (!apiKey || apiKey.trim() === "") {
      throw new Error(
        "API key is required. Please enter your Anthropic API key to generate visualizations.",
      );
    }

    try {
      return await anthropicService.generateVisualization({
        apiData,
        prompt,
        apiKey,
      });
    } catch (error) {
      console.error("AI generation failed:", error);
      throw error;
    }
  }

  /**
   * Iterate on an existing visualization based on user feedback
   *
   * @param currentCode - The current visualization code
   * @param iterationPrompt - User's modification request
   * @param apiData - The original data
   * @param apiKey - User's Anthropic API key
   */
  static async iterateVisualization(
    currentCode: GeneratedCode,
    iterationPrompt: string,
    apiData: ApiData,
    apiKey: string,
  ): Promise<GeneratedCode> {
    // Validate API key
    if (!apiKey || apiKey.trim() === "") {
      throw new Error(
        "API key is required. Please enter your Anthropic API key to generate visualizations.",
      );
    }

    try {
      return await anthropicService.generateVisualization({
        apiData,
        prompt: iterationPrompt,
        apiKey,
        currentCode: currentCode.html && currentCode.css && currentCode.javascript
          ? {
            html: currentCode.html,
            css: currentCode.css,
            javascript: currentCode.javascript,
          }
          : undefined,
      });
    } catch (error) {
      console.error("AI iteration failed:", error);
      throw error;
    }
  }
}
