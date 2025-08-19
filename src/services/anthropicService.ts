import Anthropic from "@anthropic-ai/sdk";

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
}

class AnthropicService {
  private client: Anthropic | null = null;
  private useBackendAPI: boolean = false;

  constructor() {
    // Check if we're in development and have a frontend API key
    const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
    const isDev = (import.meta as any).env?.DEV;

    if (isDev && apiKey && apiKey !== "your_api_key_here") {
      this.client = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });
    } else {
      // In production, use backend API
      this.useBackendAPI = true;
    }
  }

  isConfigured(): boolean {
    return this.client !== null || this.useBackendAPI;
  }

  async generateVisualization(request: VisualizationRequest): Promise<GeneratedCode> {
    // Use backend API in production or when no frontend API key is available
    if (this.useBackendAPI) {
      try {
        const response = await fetch('/api/generate-visualization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate visualization');
        }

        const result: GeneratedCode = await response.json();
        return result;
      } catch (error) {
        console.error('Backend API error:', error);
        throw error;
      }
    }

    // Fall back to direct API calls for development
    if (!this.client) {
      throw new Error(
        "Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env.local file",
      );
    }

    const systemPrompt = `Generate a simple HTML/CSS/JavaScript chart visualization. Return ONLY valid JSON:

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

Create a complete working chart using only native browser APIs. Draw bars, axes, labels, and make it interactive with mouse events.`;

    const userPrompt = this.buildUserPrompt(request);

    try {
      const response = await this.client.messages.create({
        model: (import.meta as any).env?.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 16000,
        temperature: 0.3,
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
      console.error("Error generating visualization:", error);
      throw error;
    }
  }

  private buildUserPrompt(request: VisualizationRequest): string {
    const { apiData, prompt, currentCode } = request;

    let userPrompt = `Create a data visualization with the following specifications:
    
    Data Source: ${apiData.url}
    Total Records: ${apiData.structure.totalRecords}
    
    Data Structure:
    ${
      apiData.structure.fields.map((field) =>
        `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`
      ).join("\n")
    }
    
    Sample Data (first 10 records):
    ${JSON.stringify(apiData.data.slice(0, 10), null, 2)}
    
    User Request: ${prompt}`;

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

  private parseResponse(text: string): Omit<GeneratedCode, "fullCode"> {
    console.log("Raw AI response length:", text.length);
    console.log("Raw AI response (full):", text);
    console.log("Response ends with:", text.slice(-100)); // Last 100 chars

    try {
      // Method 1: Try multiple JSON extraction patterns
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

      // Method 2: Extract code blocks with multiple formats
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

      const extractCode = (patterns: RegExp[]): string => {
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            return match[1] || match[0];
          }
        }
        return "";
      };

      const html = extractCode(codeBlockPatterns.html);
      const css = extractCode(codeBlockPatterns.css);
      const javascript = extractCode(codeBlockPatterns.javascript);

      if (html || css || javascript) {
        // Basic fallback if parsing succeeds but content is minimal
        const finalHtml = html || '<div id="root"></div>';
        const finalCSS = css || "body { background: #0f0f23; color: #e2e8f0; } #root { padding: 20px; }";
        let finalJS = javascript || '';
        
        // If JavaScript looks incomplete (no closing brace/semicolon), try to fix it
        if (finalJS && !finalJS.trim().endsWith(';') && !finalJS.trim().endsWith('}') && !finalJS.trim().endsWith(')')) {
          console.warn("JavaScript appears truncated, attempting basic fix");
          // Don't try to auto-fix, just warn
        }
        
        return {
          html: finalHtml,
          css: finalCSS,
          javascript: finalJS,
        };
      }

      // Method 3: Generate a working fallback chart
      console.warn("AI response could not be parsed, generating fallback Recharts chart");
      return this.generateFallbackChart();
    } catch (error) {
      console.error("Error parsing AI response:", error, "Response text:", text);
      throw new Error(
        "Failed to parse AI response. Please try again with a clearer or different prompt.",
      );
    }
  }

  private validateAndFixCode(
    code: Omit<GeneratedCode, "fullCode">,
    request: VisualizationRequest,
  ): Omit<GeneratedCode, "fullCode"> {
    const issues: string[] = [];

    // Check if code is too minimal
    if (code.html.length < 50) {
      issues.push("HTML too short");
    }

    if (code.css.length < 30) {
      issues.push("CSS too short");
    }

    if (code.javascript.length < 100) {
      issues.push("JavaScript too short");
    }

    // Check for common issues
    if (
      !code.javascript.includes("canvas") && !code.javascript.includes("svg") &&
      !code.javascript.includes("Chart")
    ) {
      issues.push("No chart drawing code detected");
    }

    // Fix CSS formatting issues
    if (code.css.includes("\\n")) {
      issues.push("CSS contains unescaped newlines");
      code.css = code.css.replace(/\\n/g, " ");
    }

    // Fix HTML issues
    if (code.html && !code.html.includes("<!DOCTYPE")) {
      // HTML fragment - wrap it properly
      code.html = code.html.trim();
    }

    // Fix JavaScript issues
    if (code.javascript) {
      // Remove any script tags if present (they'll be added by combineCode)
      code.javascript = code.javascript
        .replace(/<\/?script[^>]*>/gi, "")
        .trim();

      // Check for syntax errors in JavaScript
      try {
        new Function(code.javascript);
      } catch (syntaxError) {
        console.warn("JavaScript syntax error detected:", syntaxError);
        issues.push("JavaScript syntax error");
      }

      // Check for proper canvas/element access
      if (code.javascript.includes("getElementById") && !code.html.includes("id=")) {
        console.warn("JavaScript tries to access element by ID but HTML doesn't define any IDs");
        issues.push("Missing element ID");
      }

      // Check for vanilla JavaScript chart implementation
      const hasCanvas = code.javascript.includes("canvas") && code.javascript.includes("getContext");
      const hasSVG = code.javascript.includes("svg") || code.javascript.includes("createElementNS");
      const hasDrawing = code.javascript.includes("fillRect") || 
                         code.javascript.includes("drawLine") ||
                         code.javascript.includes("arc") ||
                         code.javascript.includes("fillText") ||
                         code.javascript.includes("strokeRect");
      
      const hasExternalLibraries = code.javascript.includes("loadScript") ||
                                   code.javascript.includes("unpkg.com") ||
                                   code.javascript.includes("cdnjs") ||
                                   code.javascript.includes("Recharts") ||
                                   code.javascript.includes("Chart.js") ||
                                   code.javascript.includes("d3.");
                               
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

      // Check for complete chart implementation
      const hasDataProcessing = code.javascript.includes("data") && code.javascript.length > 300;
      const hasEventHandlers = code.javascript.includes("addEventListener") || 
                               code.javascript.includes("onclick");
      
      if (!hasDataProcessing) {
        console.warn("JavaScript appears too short or missing data processing");
        issues.push("Incomplete chart code");
      }
    }

    // Additional validation for chart container
    if (!code.html.includes("canvas") && !code.html.includes("svg") && !code.html.includes("id=")) {
      console.warn("HTML missing chart container element");
      issues.push("Missing chart container");
    }

    // Only fail on truly critical issues that prevent execution
    const criticalIssues = issues.filter(issue => 
      issue === "JavaScript syntax error"
      // Being lenient - let minor issues pass through
    );
    
    if (criticalIssues.length > 0) {
      console.error("Generated code has critical issues:", criticalIssues);
      throw new Error(
        `AI generated invalid code: ${
          criticalIssues.join(", ")
        }. Please try again with a different or more specific prompt.`,
      );
    }

    // DEBUG: Log the generated code to see what AI is producing
    console.log("=== AI GENERATED CODE DEBUG ===");
    console.log("HTML:", code.html);
    console.log("CSS:", code.css);
    console.log("JavaScript (first 1000 chars):", code.javascript.substring(0, 1000));
    console.log("Issues found:", issues);
    console.log("================================");
    
    console.log("Code validation passed with", issues.length, "minor issues:", issues);
    return code;
  }

  private generateFallbackChart(): Omit<GeneratedCode, "fullCode"> {
    return {
      html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
      css: 'body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}#chart{width:100%;height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}canvas{max-width:100%;max-height:100%;background:rgba(30,30,60,0.3);border-radius:8px}',
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
`
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
