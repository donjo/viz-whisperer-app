/// <reference lib="deno.ns" />
import Anthropic from "@anthropic-ai/sdk";
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let visualizationId: string | undefined;
  
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      return Response.json({
        error: 'Anthropic API key not configured on server'
      }, { status: 500 });
    }

    const requestData: VisualizationRequest = await req.json();
    
    // Start deployment logging
    visualizationId = crypto.randomUUID();
    const deploymentLog = deploymentLogger.startDeployment(visualizationId);
    
    const client = new Anthropic({
      apiKey: apiKey,
    });

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

CRITICAL DATA FILTERING REQUIREMENTS:
8. ALWAYS respect user-specified time periods, date ranges, and record limits
9. Use JavaScript array methods (filter, slice, etc.) to limit data BEFORE creating the visualization
10. If user mentions "last X days/months", "recent", "top N", "between dates", etc. - implement proper filtering
11. Do NOT display all available data unless specifically requested
12. Include clear chart titles and labels indicating what time period or data subset is shown
13. When filtering by dates, parse date strings properly and use Date objects for comparison

Create a complete working chart using only native browser APIs. Draw bars, axes, labels, and make it interactive with mouse events.`;

    const userPrompt = buildUserPrompt(requestData);

    deploymentLogger.logEvent(visualizationId, 'generation', 'Sending request to AI for visualization code');

    const response = await client.messages.create({
      model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const parsed = parseResponse(content.text);
      const validated = validateAndFixCode(parsed, requestData);
      
      deploymentLogger.logEvent(visualizationId, 'generation', 'AI generation complete, preparing deployment');
      
      // Create the result with traditional fullCode for backwards compatibility
      const result: GeneratedCode = {
        ...validated,
        fullCode: combineCode(validated.html, validated.css, validated.javascript),
        visualizationId, // Add the ID so the client can track deployment
      };
      
      // Create a sandbox for the visualization (optional - fallback if it fails)
      try {
        // Add a timeout to prevent sandbox creation from hanging indefinitely
        const sandboxPromise = sandboxService.createVisualization({
          html: validated.html,
          css: validated.css,
          javascript: validated.javascript
        }, visualizationId);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Sandbox creation timeout after 5 seconds')), 5000);
        });
        
        const sandbox = await Promise.race([sandboxPromise, timeoutPromise]) as { id: string; url: string };
        
        result.sandboxId = sandbox.id;
        result.sandboxUrl = sandbox.url;
        console.log(`Created sandbox ${sandbox.id} for visualization at ${sandbox.url}`);
        deploymentLogger.markReady(visualizationId);
      } catch (sandboxError) {
        console.warn('Sandbox creation failed or timed out, continuing without sandbox:', sandboxError);
        // Mark as ready even if sandbox fails since we have the visualization code
        deploymentLogger.markReady(visualizationId);
        // Still return the visualization code even if sandbox fails
      }
      
      return Response.json(result);
    }

    return Response.json({
      error: 'Unexpected response format from AI'
    }, { status: 500 });

  } catch (error) {
    console.error('Error generating visualization:', error);
    
    // Try to log the error if we have a visualization ID
    try {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate visualization';
      // Note: visualizationId might not be available if error occurred early
      if (typeof visualizationId !== 'undefined') {
        deploymentLogger.markFailed(visualizationId, errorMessage, error);
      }
    } catch (logError) {
      console.error('Failed to log deployment error:', logError);
    }
    
    return Response.json({
      error: 'Failed to generate visualization'
    }, { status: 500 });
  }
}

// Helper function to identify date/time fields in the data structure
function identifyDateFields(fields: Array<{name: string, type: string, sample: any}>): Array<{name: string, type: string, sample: any}> {
  return fields.filter(field => {
    const fieldName = field.name.toLowerCase();
    const sampleValue = String(field.sample);
    
    // Check if field name suggests it's a date
    const dateNamePatterns = [
      'date', 'time', 'created', 'updated', 'modified', 'timestamp', 
      'datetime', 'start', 'end', 'published', 'scheduled'
    ];
    
    const hasDateName = dateNamePatterns.some(pattern => fieldName.includes(pattern));
    
    // Check if sample value looks like a date
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, // ISO datetime
      /^\d{10,13}$/ // Unix timestamp
    ];
    
    const hasDateFormat = datePatterns.some(pattern => pattern.test(sampleValue));
    
    return hasDateName || hasDateFormat;
  });
}

// Helper function to detect time-related requests in user prompts
function analyzeTimeRequest(prompt: string): {
  hasTimeRequest: boolean;
  timeKeywords: string[];
  suggestedInstructions: string;
} {
  const timeKeywords = [
    'last', 'past', 'recent', 'days', 'weeks', 'months', 'years',
    'since', 'before', 'after', 'between', 'from', 'to', 'until',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'q1', 'q2', 'q3', 'q4', 'quarter', 'today', 'yesterday', 'tomorrow',
    '2023', '2024', '2025', 'this year', 'last year', 'ytd'
  ];
  
  const foundKeywords = timeKeywords.filter(keyword => 
    prompt.toLowerCase().includes(keyword.toLowerCase())
  );
  
  const hasTimeRequest = foundKeywords.length > 0;
  
  let suggestedInstructions = '';
  if (hasTimeRequest) {
    suggestedInstructions = `
CRITICAL FILTERING REQUIREMENTS:
- The user requested time-based filtering with terms: ${foundKeywords.join(', ')}
- You MUST implement proper date filtering in your JavaScript code
- Only include data that matches the specified time period
- Do NOT show all data - filter it according to the user's time requirements
- If specific dates aren't clear, use reasonable defaults based on the context`;
  }
  
  return {
    hasTimeRequest,
    timeKeywords: foundKeywords,
    suggestedInstructions
  };
}

// Helper function to get data range information
function getDataRangeInfo(data: any[], dateFields: Array<{name: string, type: string, sample: any}>): string {
  if (dateFields.length === 0 || data.length === 0) {
    return '';
  }
  
  const primaryDateField = dateFields[0];
  const dates = data
    .map(record => record[primaryDateField.name])
    .filter(date => date != null)
    .map(date => new Date(date))
    .filter(date => !isNaN(date.getTime()));
  
  if (dates.length === 0) {
    return '';
  }
  
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  return `
Data Date Range Information:
- Primary date field: "${primaryDateField.name}"
- Data spans from: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}
- Total time span: ${Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))} days`;
}

function buildUserPrompt(request: VisualizationRequest): string {
  const { apiData, prompt, currentCode } = request;
  
  // Analyze the data structure for date fields
  const dateFields = identifyDateFields(apiData.structure.fields);
  const timeAnalysis = analyzeTimeRequest(prompt);
  const dataRangeInfo = getDataRangeInfo(apiData.data, dateFields);

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
  ${dateFields.map(field => `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`).join('\n')}`;
  }

  // Add data range information
  if (dataRangeInfo) {
    userPrompt += dataRangeInfo;
  }

  userPrompt += `
  
  Sample Data (first 10 records):
  ${JSON.stringify(apiData.data.slice(0, 10), null, 2)}
  
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

function parseResponse(text: string): Omit<GeneratedCode, "fullCode"> {
  try {
    const jsonPatterns = [
      /\{[\s\S]*"javascript"[\s\S]*\}/,
      /\{[\s\S]*\}/,
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
          continue;
        }
      }
    }

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
      const finalHtml = html || '<div id="root"></div>';
      const finalCSS = css || "body { background: #0f0f23; color: #e2e8f0; } #root { padding: 20px; }";
      const finalJS = javascript || '';
      
      return {
        html: finalHtml,
        css: finalCSS,
        javascript: finalJS,
      };
    }

    return generateFallbackChart();
  } catch (error) {
    console.error('Error parsing AI response:', error);
    throw new Error('Failed to parse AI response. Please try again with a clearer prompt.');
  }
}

function validateAndFixCode(
  code: Omit<GeneratedCode, "fullCode">,
  request: VisualizationRequest,
): Omit<GeneratedCode, "fullCode"> {
  if (code.css.includes("\\n")) {
    code.css = code.css.replace(/\\n/g, " ");
  }

  if (code.html && !code.html.includes("<!DOCTYPE")) {
    code.html = code.html.trim();
  }

  if (code.javascript) {
    code.javascript = code.javascript
      .replace(/<\/?script[^>]*>/gi, "")
      .trim();
  }

  return code;
}

function generateFallbackChart(): Omit<GeneratedCode, "fullCode"> {
  return {
    html: '<div id="chart"><canvas id="chartCanvas"></canvas></div>',
    css: 'body{background:#0f0f23;color:#e2e8f0;margin:0;font-family:Arial}#chart{width:100%;height:100vh;padding:20px;display:flex;justify-content:center;align-items:center}canvas{max-width:100%;max-height:100%;background:rgba(30,30,60,0.3);border-radius:8px}',
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
`
  };
}

function combineCode(html: string, css: string, javascript: string): string {
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