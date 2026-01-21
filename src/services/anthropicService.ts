import Anthropic from "@anthropic-ai/sdk";

// Configuration constants
const CONFIG = {
  API: {
    MAX_TOKENS: 16000,
    TEMPERATURE: 0.3,
    DEFAULT_MODEL: "claude-sonnet-4-5-20250929",
  },
  VALIDATION: {
    MIN_HTML_LENGTH: 50,
    MIN_CSS_LENGTH: 30,
    MIN_JS_LENGTH: 100,
    MIN_JS_LENGTH_FOR_CHART: 300,
  },
  DATA_SAMPLING: {
    MAX_SAMPLE_RECORDS: 10,
    MAX_RESPONSE_DEBUG_LENGTH: 100,
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
  currentCode?: {
    html: string;
    css: string;
    javascript: string;
  };
}

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
  fullCode: string;
  sandboxId?: string;
  sandboxUrl?: string;
  visualizationId?: string;
}

class AnthropicService {
  private client: Anthropic | null = null;
  private useBackendAPI: boolean = false;

  constructor() {
    // Always use backend API for sandbox deployment and visualization tracking
    // The backend API includes deployment logging, sandbox creation, and monitoring
    this.useBackendAPI = true;
    console.log("🔧 AnthropicService: Using backend API for full deployment pipeline");
  }

  isConfigured(): boolean {
    return this.client !== null || this.useBackendAPI;
  }

  async generateVisualization(request: VisualizationRequest): Promise<GeneratedCode> {
    // Use backend API in production or when no frontend API key is available
    if (this.useBackendAPI) {
      try {
        const response = await fetch("/api/generate-visualization", {
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
          url: "/api/generate-visualization",
          method: "POST",
          originalError: error,
        });
        throw new Error(`Failed to generate visualization via backend API: ${errorMessage}`);
      }
    }

    // Fall back to direct API calls for development
    if (!this.client) {
      throw new Error(
        "Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env.local file",
      );
    }

    const systemPrompt =
      `Generate a simple HTML/CSS/JavaScript chart visualization. Return ONLY valid JSON:

{
  "html": "<div id='chart'></div>",
  "css": "body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}#chart{width:100%;height:100vh;padding:20px}",
  "javascript": "WORKING_CHART_CODE"
}

REQUIREMENTS:
1. Use vanilla JavaScript and HTML5 Canvas or SVG for charts
2. NO external libraries - create charts from scratch
3. Dark theme: background #0f0f23, text #e2e8f0, bars #60a5fa
4. Make it responsive and interactive
5. Include hover effects and labels
6. Transform the provided data into a working visualization
7. Use canvas.getContext('2d') for drawing

CRITICAL DATA FILTERING REQUIREMENTS:
8. ALWAYS respect user-specified time periods, date ranges, and record limits
9. Use JavaScript array methods (filter, slice, etc.) to limit data BEFORE creating the visualization
10. If user mentions "last X days/months", "recent", "top N", "between dates", etc. - implement proper filtering
11. Do NOT display all available data unless specifically requested
12. Include clear chart titles and labels indicating what time period or data subset is shown
13. When filtering by dates, parse date strings properly and use Date objects for comparison

Create a complete working chart using only native browser APIs. Draw bars, axes, labels, and make it interactive with mouse events.`;

    const userPrompt = this.buildUserPrompt(request);

    try {
      const response = await this.client.messages.create({
        model: (import.meta as any).env?.VITE_ANTHROPIC_MODEL || CONFIG.API.DEFAULT_MODEL,
        max_tokens: CONFIG.API.MAX_TOKENS,
        temperature: CONFIG.API.TEMPERATURE,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const parsed = this.parseResponse(content.text);
        const validated = this.validateAndFixCode(parsed, request);
        return {
          ...validated,
          fullCode: this.combineCode(validated.html, validated.css, validated.javascript),
        };
      }

      throw new Error("Unexpected response format from AI");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error generating visualization via direct API:", errorMessage, {
        model: (import.meta as any).env?.VITE_ANTHROPIC_MODEL || CONFIG.API.DEFAULT_MODEL,
        maxTokens: CONFIG.API.MAX_TOKENS,
        originalError: error,
      });
      throw new Error(`Failed to generate visualization: ${errorMessage}`);
    }
  }

  private buildUserPrompt(request: VisualizationRequest): string {
    const { apiData, prompt, currentCode } = request;

    // Analyze the data structure for date fields
    const dateFields = this.identifyDateFields(apiData.structure.fields);
    const timeAnalysis = this.analyzeTimeRequest(prompt);
    const dataRangeInfo = this.getDataRangeInfo(apiData.data, dateFields);

    let userPrompt = `Create a data visualization with the following specifications:
    
    Data Source: ${apiData.url}
    Total Records: ${apiData.structure.totalRecords}
    
    Data Structure:
    ${
      apiData.structure.fields.map((field) =>
        `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`
      ).join("\n")
    }`;

    // Add date field information if present
    if (dateFields.length > 0) {
      userPrompt += `
    
    Detected Date/Time Fields:
    ${
        dateFields.map((field) =>
          `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`
        ).join("\n")
      }`;
    }

    // Add data range information
    if (dataRangeInfo) {
      userPrompt += dataRangeInfo;
    }

    userPrompt += `
    
    Sample Data (first ${CONFIG.DATA_SAMPLING.MAX_SAMPLE_RECORDS} records):
    ${JSON.stringify(apiData.data.slice(0, CONFIG.DATA_SAMPLING.MAX_SAMPLE_RECORDS), null, 2)}
    
    User Request: ${prompt}`;

    // Add time-specific filtering instructions if detected
    if (timeAnalysis.hasTimeRequest) {
      userPrompt += timeAnalysis.suggestedInstructions;
    }

    // Add general data filtering guidance
    userPrompt += `

IMPORTANT DATA HANDLING INSTRUCTIONS:
1. If the user specifies a time period, date range, or record limit, you MUST implement filtering in your JavaScript code
2. Use JavaScript's filter(), slice(), or other array methods to limit the data before visualization
3. Do NOT display all ${apiData.structure.totalRecords} records unless specifically requested
4. Pay attention to any mention of "last X days/months", "recent", "top N", "limit", etc.
5. Include clear labels showing what data period/subset is being displayed`;

    if (currentCode) {
      userPrompt += `
      
      Current Visualization Code to Modify:
      HTML: ${currentCode.html}
      CSS: ${currentCode.css}
      JavaScript: ${currentCode.javascript}
      
      Please modify the existing code based on the user's request.`;
    }

    return userPrompt;
  }

  // Helper function to identify date/time fields in the data structure
  private identifyDateFields(
    fields: Array<{ name: string; type: string; sample: any }>,
  ): Array<{ name: string; type: string; sample: any }> {
    return fields.filter((field) => {
      const fieldName = field.name.toLowerCase();
      const sampleValue = String(field.sample);

      // Check if field name suggests it's a date
      const dateNamePatterns = [
        "date",
        "time",
        "created",
        "updated",
        "modified",
        "timestamp",
        "datetime",
        "start",
        "end",
        "published",
        "scheduled",
      ];

      const hasDateName = dateNamePatterns.some((pattern) => fieldName.includes(pattern));

      // Check if sample value looks like a date
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, // ISO datetime
        /^\d{10,13}$/, // Unix timestamp
      ];

      const hasDateFormat = datePatterns.some((pattern) => pattern.test(sampleValue));

      return hasDateName || hasDateFormat;
    });
  }

  // Helper function to detect time-related requests in user prompts
  private analyzeTimeRequest(prompt: string): {
    hasTimeRequest: boolean;
    timeKeywords: string[];
    suggestedInstructions: string;
  } {
    const timeKeywords = [
      "last",
      "past",
      "recent",
      "days",
      "weeks",
      "months",
      "years",
      "since",
      "before",
      "after",
      "between",
      "from",
      "to",
      "until",
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
      "q1",
      "q2",
      "q3",
      "q4",
      "quarter",
      "today",
      "yesterday",
      "tomorrow",
      "2023",
      "2024",
      "2025",
      "this year",
      "last year",
      "ytd",
    ];

    const foundKeywords = timeKeywords.filter((keyword) =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );

    const hasTimeRequest = foundKeywords.length > 0;

    let suggestedInstructions = "";
    if (hasTimeRequest) {
      suggestedInstructions = `
CRITICAL FILTERING REQUIREMENTS:
- The user requested time-based filtering with terms: ${foundKeywords.join(", ")}
- You MUST implement proper date filtering in your JavaScript code
- Only include data that matches the specified time period
- Do NOT show all data - filter it according to the user's time requirements
- If specific dates aren't clear, use reasonable defaults based on the context`;
    }

    return {
      hasTimeRequest,
      timeKeywords: foundKeywords,
      suggestedInstructions,
    };
  }

  // Helper function to get data range information
  private getDataRangeInfo(
    data: any[],
    dateFields: Array<{ name: string; type: string; sample: any }>,
  ): string {
    if (dateFields.length === 0 || data.length === 0) {
      return "";
    }

    const primaryDateField = dateFields[0];
    const dates = data
      .map((record) => record[primaryDateField.name])
      .filter((date) => date != null)
      .map((date) => new Date(date))
      .filter((date) => !isNaN(date.getTime()));

    if (dates.length === 0) {
      return "";
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    return `
Data Date Range Information:
- Primary date field: "${primaryDateField.name}"
- Data spans from: ${minDate.toISOString().split("T")[0]} to ${maxDate.toISOString().split("T")[0]}
- Total time span: ${
      Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
    } days`;
  }

  private parseResponse(text: string): Omit<GeneratedCode, "fullCode"> {
    this.logResponseDebugInfo(text);

    try {
      // Try to extract as JSON first
      const jsonResult = this.tryExtractAsJson(text);
      if (jsonResult) return jsonResult;

      // Try to extract code blocks
      const codeBlockResult = this.tryExtractCodeBlocks(text);
      if (codeBlockResult) return codeBlockResult;

      // Fallback to generated chart
      console.warn("AI response could not be parsed, generating fallback chart");
      return this.generateFallbackChart();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error parsing AI response:", errorMessage, {
        responseLength: text.length,
        responsePreview: text.slice(0, 200),
        originalError: error,
      });
      throw new Error(
        `Failed to parse AI response: ${errorMessage}. Please try again with a clearer or different prompt.`,
      );
    }
  }

  private logResponseDebugInfo(text: string): void {
    console.log("Raw AI response length:", text.length);
    console.log("Raw AI response (full):", text);
    console.log("Response ends with:", text.slice(-CONFIG.DATA_SAMPLING.MAX_RESPONSE_DEBUG_LENGTH));
  }

  private tryExtractAsJson(text: string): Omit<GeneratedCode, "fullCode"> | null {
    const jsonPatterns = [
      /\{[\s\S]*"javascript"[\s\S]*\}/, // Look for complete JSON with all fields
      /\{[\s\S]*\}/, // Fallback to any JSON-like structure
    ];

    for (const pattern of jsonPatterns) {
      const jsonMatch = text.match(pattern);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.html && parsed.css && parsed.javascript) {
            return {
              html: parsed.html,
              css: parsed.css,
              javascript: parsed.javascript,
            };
          }
        } catch (jsonError) {
          console.warn("JSON parse failed for pattern:", pattern);
          continue;
        }
      }
    }
    return null;
  }

  private tryExtractCodeBlocks(text: string): Omit<GeneratedCode, "fullCode"> | null {
    const codeBlockPatterns = {
      html: [
        /```html\n([\s\S]*?)```/,
        /```HTML\n([\s\S]*?)```/,
        /<html[\s\S]*<\/html>/i,
        /<div[\s\S]*<\/div>/i,
      ],
      css: [
        /```css\n([\s\S]*?)```/,
        /```CSS\n([\s\S]*?)```/,
        /<style>([\s\S]*?)<\/style>/i,
        /\.[\w-]+\s*\{[\s\S]*?\}/,
      ],
      javascript: [
        /```javascript\n([\s\S]*?)```/,
        /```js\n([\s\S]*?)```/,
        /```JavaScript\n([\s\S]*?)```/,
        /<script>([\s\S]*?)<\/script>/i,
        /function[\s\S]*?\}/,
        /const\s+\w+[\s\S]*?;/,
      ],
    };

    const extractCode = (patterns: RegExp[], text: string): string => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1] || match[0];
        }
      }
      return "";
    };

    const html = extractCode(codeBlockPatterns.html, text);
    const css = extractCode(codeBlockPatterns.css, text);
    const javascript = extractCode(codeBlockPatterns.javascript, text);

    if (html || css || javascript) {
      return this.normalizeExtractedCode(html, css, javascript);
    }

    return null;
  }

  private normalizeExtractedCode(
    html: string,
    css: string,
    javascript: string,
  ): Omit<GeneratedCode, "fullCode"> {
    const finalHtml = html || '<div id="root"></div>';
    const finalCSS = css ||
      "body { background: #0f0f23; color: #e2e8f0; } #root { padding: 20px; }";
    const finalJS = javascript || "";

    // Check for truncated JavaScript
    if (
      finalJS && !finalJS.trim().endsWith(";") && !finalJS.trim().endsWith("}") &&
      !finalJS.trim().endsWith(")")
    ) {
      console.warn("JavaScript appears truncated");
    }

    return {
      html: finalHtml,
      css: finalCSS,
      javascript: finalJS,
    };
  }

  private validateAndFixCode(
    code: Omit<GeneratedCode, "fullCode">,
    request: VisualizationRequest,
  ): Omit<GeneratedCode, "fullCode"> {
    const issues: string[] = [];

    // Perform various validations
    this.validateCodeLength(code, issues);
    code = this.fixCSSFormatting(code, issues);
    code = this.cleanupHTML(code);
    code = this.validateAndCleanJavaScript(code, issues);
    this.validateChartContainer(code, issues);

    // Check for critical issues
    this.checkForCriticalIssues(issues);

    // Debug logging
    this.logValidationDebugInfo(code, issues);

    return code;
  }

  private validateCodeLength(code: Omit<GeneratedCode, "fullCode">, issues: string[]): void {
    if (code.html.length < CONFIG.VALIDATION.MIN_HTML_LENGTH) {
      issues.push("HTML too short");
    }

    if (code.css.length < CONFIG.VALIDATION.MIN_CSS_LENGTH) {
      issues.push("CSS too short");
    }

    if (code.javascript.length < CONFIG.VALIDATION.MIN_JS_LENGTH) {
      issues.push("JavaScript too short");
    }
  }

  private fixCSSFormatting(
    code: Omit<GeneratedCode, "fullCode">,
    issues: string[],
  ): Omit<GeneratedCode, "fullCode"> {
    if (code.css.includes("\\n")) {
      issues.push("CSS contains unescaped newlines");
      code.css = code.css.replace(/\\n/g, " ");
    }
    return code;
  }

  private cleanupHTML(code: Omit<GeneratedCode, "fullCode">): Omit<GeneratedCode, "fullCode"> {
    if (code.html && !code.html.includes("<!DOCTYPE")) {
      // HTML fragment - wrap it properly
      code.html = code.html.trim();
    }
    return code;
  }

  private validateAndCleanJavaScript(
    code: Omit<GeneratedCode, "fullCode">,
    issues: string[],
  ): Omit<GeneratedCode, "fullCode"> {
    if (!code.javascript) return code;

    // Remove any script tags if present
    code.javascript = code.javascript
      .replace(/<\/?script[^>]*>/gi, "")
      .trim();

    // Check for syntax errors
    this.checkJavaScriptSyntax(code.javascript, issues);

    // Check for proper element access
    this.checkElementAccess(code, issues);

    // Check chart implementation
    this.validateChartImplementation(code.javascript, issues);

    return code;
  }

  private checkJavaScriptSyntax(javascript: string, issues: string[]): void {
    try {
      new Function(javascript);
    } catch (syntaxError) {
      const errorMessage = syntaxError instanceof Error
        ? syntaxError.message
        : "Unknown syntax error";
      console.warn("JavaScript syntax error detected:", errorMessage, {
        codeLength: javascript.length,
        codePreview: javascript.slice(0, 100),
        syntaxError,
      });
      issues.push("JavaScript syntax error");
    }
  }

  private checkElementAccess(code: Omit<GeneratedCode, "fullCode">, issues: string[]): void {
    if (code.javascript.includes("getElementById") && !code.html.includes("id=")) {
      console.warn("JavaScript tries to access element by ID but HTML doesn't define any IDs");
      issues.push("Missing element ID");
    }
  }

  private validateChartImplementation(javascript: string, issues: string[]): void {
    const hasCanvas = javascript.includes("canvas") && javascript.includes("getContext");
    const hasSVG = javascript.includes("svg") || javascript.includes("createElementNS");
    const hasDrawing = this.checkForDrawingCommands(javascript);
    const hasExternalLibraries = this.checkForExternalLibraries(javascript);
    const hasDataProcessing = javascript.includes("data") &&
      javascript.length > CONFIG.VALIDATION.MIN_JS_LENGTH_FOR_CHART;

    if (hasExternalLibraries) {
      console.warn("JavaScript uses external libraries - should use vanilla JS only");
      issues.push("External libraries detected");
    }

    if (!hasCanvas && !hasSVG) {
      console.warn("JavaScript doesn't appear to use Canvas or SVG");
      issues.push("Missing chart rendering");
    }

    if (!hasDrawing) {
      console.warn("JavaScript doesn't appear to have drawing commands");
      issues.push("Missing drawing code");
    }

    if (!hasDataProcessing) {
      console.warn("JavaScript appears too short or missing data processing");
      issues.push("Incomplete chart code");
    }
  }

  private checkForDrawingCommands(javascript: string): boolean {
    const drawingCommands = [
      "fillRect",
      "drawLine",
      "arc",
      "fillText",
      "strokeRect",
    ];
    return drawingCommands.some((cmd) => javascript.includes(cmd));
  }

  private checkForExternalLibraries(javascript: string): boolean {
    const externalLibraries = [
      "loadScript",
      "unpkg.com",
      "cdnjs",
      "Recharts",
      "Chart.js",
      "d3.",
    ];
    return externalLibraries.some((lib) => javascript.includes(lib));
  }

  private validateChartContainer(code: Omit<GeneratedCode, "fullCode">, issues: string[]): void {
    if (!code.html.includes("canvas") && !code.html.includes("svg") && !code.html.includes("id=")) {
      console.warn("HTML missing chart container element");
      issues.push("Missing chart container");
    }
  }

  private checkForCriticalIssues(issues: string[]): void {
    const criticalIssues = issues.filter((issue) => issue === "JavaScript syntax error");

    if (criticalIssues.length > 0) {
      console.error("Generated code has critical issues:", criticalIssues);
      throw new Error(
        `AI generated invalid code: ${
          criticalIssues.join(", ")
        }. Please try again with a different or more specific prompt.`,
      );
    }
  }

  private logValidationDebugInfo(code: Omit<GeneratedCode, "fullCode">, issues: string[]): void {
    console.log("=== AI GENERATED CODE DEBUG ===");
    console.log("HTML:", code.html);
    console.log("CSS:", code.css);
    console.log("JavaScript (first 1000 chars):", code.javascript.substring(0, 1000));
    console.log("Issues found:", issues);
    console.log("================================");

    console.log("Code validation passed with", issues.length, "minor issues:", issues);
  }

  private generateFallbackChart(): Omit<GeneratedCode, "fullCode"> {
    return {
      html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
      css:
        "body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}#chart{width:100%;height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}canvas{max-width:100%;max-height:100%;background:rgba(30,30,60,0.3);border-radius:8px}",
      javascript: `
// Create a simple vanilla JS bar chart
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
const resizeCanvas = () => {
  const container = canvas.parentElement;
  canvas.width = Math.min(container.clientWidth - 40, 800);
  canvas.height = Math.min(container.clientHeight - 40, 500);
  drawChart();
};

// Sample data
const data = [
  { name: 'A', value: 400 },
  { name: 'B', value: 300 },
  { name: 'C', value: 300 },
  { name: 'D', value: 200 }
];

const drawChart = () => {
  const width = canvas.width;
  const height = canvas.height;
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Find max value
  const maxValue = Math.max(...data.map(d => d.value));
  
  // Draw bars
  const barWidth = chartWidth / data.length * 0.8;
  const barSpacing = chartWidth / data.length * 0.2;
  
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = margin.left + index * (barWidth + barSpacing) + barSpacing / 2;
    const y = margin.top + chartHeight - barHeight;
    
    // Draw bar
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Draw label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + barWidth / 2, height - margin.bottom + 20);
    
    // Draw value
    ctx.fillText(item.value, x + barWidth / 2, y - 10);
  });
  
  // Draw axes
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Y axis
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartHeight);
  // X axis
  ctx.moveTo(margin.left, margin.top + chartHeight);
  ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
  ctx.stroke();
  
  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Sample Data Visualization', width / 2, 25);
};

// Initialize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Add hover effects
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  canvas.style.cursor = 'default';
  
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const chartWidth = canvas.width - margin.left - margin.right;
  const chartHeight = canvas.height - margin.top - margin.bottom;
  const barWidth = chartWidth / data.length * 0.8;
  const barSpacing = chartWidth / data.length * 0.2;
  
  data.forEach((item, index) => {
    const barX = margin.left + index * (barWidth + barSpacing) + barSpacing / 2;
    const barHeight = (item.value / Math.max(...data.map(d => d.value))) * chartHeight;
    const barY = margin.top + chartHeight - barHeight;
    
    if (x >= barX && x <= barX + barWidth && y >= barY && y <= barY + barHeight) {
      canvas.style.cursor = 'pointer';
    }
  });
});
`,
    };
  }

  private combineCode(html: string, css: string, javascript: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Visualization</title>
    <style>
${css}
    </style>
</head>
<body>
    ${html}
    <script>
${javascript}
    </script>
</body>
</html>`;
  }
}

export const anthropicService = new AnthropicService();
