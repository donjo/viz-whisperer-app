import { anthropicService } from "@/services/anthropicService";

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
  html: string;
  css: string;
  javascript: string;
  fullCode: string;
  sandboxId?: string;
  sandboxUrl?: string;
}

export class CodeGenerator {
  static async generateVisualization(
    apiData: ApiData,
    prompt: string,
  ): Promise<GeneratedCode> {
    // Only use AI service - no fallback mock
    if (!anthropicService.isConfigured()) {
      throw new Error(
        "Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env.local file to generate visualizations.",
      );
    }

    try {
      return await anthropicService.generateVisualization({
        apiData,
        prompt,
      });
    } catch (error) {
      console.error("AI generation failed:", error);
      throw error; // Re-throw to let the UI handle the error
    }
  }

  static async iterateVisualization(
    currentCode: GeneratedCode,
    iterationPrompt: string,
    apiData: ApiData,
  ): Promise<GeneratedCode> {
    // Only use AI service - no fallback mock
    if (!anthropicService.isConfigured()) {
      throw new Error(
        "Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env.local file to generate visualizations.",
      );
    }

    try {
      return await anthropicService.generateVisualization({
        apiData,
        prompt: iterationPrompt,
        currentCode: {
          html: currentCode.html,
          css: currentCode.css,
          javascript: currentCode.javascript,
        },
      });
    } catch (error) {
      console.error("AI iteration failed:", error);
      throw error; // Re-throw to let the UI handle the error
    }
  }
}
