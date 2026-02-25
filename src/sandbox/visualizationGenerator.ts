/**
 * Visualization Generator - Runs INSIDE the sandbox
 *
 * This code executes within a Deno sandbox with:
 * - ANTHROPIC_API_KEY injected via secrets (only exposed to api.anthropic.com)
 * - Network restricted to api.anthropic.com only via allowNet
 *
 * The sandbox receives request data via Deno.args[0] (JSON string),
 * calls Anthropic to generate visualization code, and serves it via HTTP.
 */

import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

// Types for request/response
interface VisualizationRequest {
  apiData: {
    url: string;
    data: any[];
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
  model?: string;
}

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

// Parse request from command line argument
const requestJson = Deno.args[0];
if (!requestJson) {
  console.error("No request data provided");
  Deno.exit(1);
}

let request: VisualizationRequest;
try {
  request = JSON.parse(requestJson);
} catch (error) {
  console.error("Failed to parse request JSON:", error);
  Deno.exit(1);
}

// Initialize Anthropic client - uses ANTHROPIC_API_KEY from environment
// The key is securely injected via sandbox secrets feature
const anthropic = new Anthropic();

// System prompt for visualization generation
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

// Build the user prompt
function buildUserPrompt(req: VisualizationRequest): string {
  const { apiData, prompt, currentCode } = req;

  // Identify date fields
  const dateFields = apiData.structure.fields.filter((field) => {
    const fieldName = field.name.toLowerCase();
    const sampleValue = String(field.sample);
    const dateNamePatterns = [
      "date",
      "time",
      "created",
      "updated",
      "modified",
      "timestamp",
    ];
    const hasDateName = dateNamePatterns.some((pattern) => fieldName.includes(pattern));
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    ];
    const hasDateFormat = datePatterns.some((pattern) => pattern.test(sampleValue));
    return hasDateName || hasDateFormat;
  });

  let userPrompt = `Create a data visualization with the following specifications:

  Data Source: ${apiData.url}
  Total Records: ${apiData.structure.totalRecords}

  Data Structure:
  ${
    apiData.structure.fields
      .map((field) => `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`)
      .join("\n")
  }`;

  if (dateFields.length > 0) {
    userPrompt += `

  Detected Date/Time Fields:
  ${
      dateFields
        .map((field) => `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`)
        .join("\n")
    }`;
  }

  userPrompt += `

  Sample Data (first 10 records):
  ${JSON.stringify(apiData.data.slice(0, 10), null, 2)}

  User Request: ${prompt}

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

// Parse the AI response to extract code
function parseResponse(text: string): GeneratedCode {
  // Try JSON patterns first
  const jsonPatterns = [/\{[\s\S]*"javascript"[\s\S]*\}/, /\{[\s\S]*\}/];

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
      } catch {
        continue;
      }
    }
  }

  // Fallback chart if parsing fails
  return generateFallbackChart();
}

function generateFallbackChart(): GeneratedCode {
  return {
    html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
    css: `body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}
#chart{width:100%;height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}
canvas{max-width:100%;max-height:100%;background:rgba(30,30,60,0.3);border-radius:8px}`,
    javascript: `
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');

const resizeCanvas = () => {
  const container = canvas.parentElement;
  canvas.width = Math.min(container.clientWidth - 40, 800);
  canvas.height = Math.min(container.clientHeight - 40, 500);
  drawChart();
};

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

  ctx.clearRect(0, 0, width, height);

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = chartWidth / data.length * 0.8;
  const barSpacing = chartWidth / data.length * 0.2;

  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = margin.left + index * (barWidth + barSpacing) + barSpacing / 2;
    const y = margin.top + chartHeight - barHeight;

    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + barWidth / 2, height - margin.bottom + 20);
    ctx.fillText(item.value, x + barWidth / 2, y - 10);
  });

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartHeight);
  ctx.moveTo(margin.left, margin.top + chartHeight);
  ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Sample Data Visualization', width / 2, 25);
};

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
`,
  };
}

// Build complete HTML document
function buildHtml(code: GeneratedCode): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Visualization</title>
    <style>
${code.css}
    </style>
</head>
<body>
    ${code.html}
    <script>
${code.javascript}
    </script>
</body>
</html>`;
}

// Main execution
let generatedHtml: string;
let generationError: string | null = null;

try {
  console.log("Calling Anthropic API to generate visualization...");

  const userPrompt = buildUserPrompt(request);
  const model = request.model || Deno.env.get("MODEL") || "claude-sonnet-4-6";

  const response = await anthropic.messages.create({
    model: model,
    max_tokens: 16000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type === "text") {
    const code = parseResponse(content.text);
    generatedHtml = buildHtml(code);
    console.log("Visualization generated successfully");
  } else {
    throw new Error("Unexpected response format from AI");
  }
} catch (error) {
  console.error("Failed to generate visualization:", error);
  generationError = error instanceof Error ? error.message : "Unknown error";

  // Generate fallback HTML with error message
  const fallback = generateFallbackChart();
  generatedHtml = buildHtml(fallback);
}

// Serve the visualization via HTTP
Deno.serve((req: Request) => {
  const url = new URL(req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Health check endpoint
  if (url.pathname === "/health") {
    return Response.json({
      status: generationError ? "error" : "ok",
      error: generationError,
    });
  }

  // Serve the visualization
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(generatedHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // 404 for other paths
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
