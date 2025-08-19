/// <reference lib="deno.ns" />
import Anthropic from "@anthropic-ai/sdk";
import { sandboxService } from "../src/services/sandboxService.ts";

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      return Response.json({
        error: 'Anthropic API key not configured on server'
      }, { status: 500 });
    }

    const requestData: VisualizationRequest = await req.json();
    
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

Create a complete working chart using only native browser APIs. Draw bars, axes, labels, and make it interactive with mouse events.`;

    const userPrompt = buildUserPrompt(requestData);

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
      
      // Create the result with traditional fullCode for backwards compatibility
      const result: GeneratedCode = {
        ...validated,
        fullCode: combineCode(validated.html, validated.css, validated.javascript),
      };
      
      // Try to create a sandbox for the visualization
      try {
        const sandbox = await sandboxService.createVisualization({
          html: validated.html,
          css: validated.css,
          javascript: validated.javascript
        });
        
        result.sandboxId = sandbox.id;
        result.sandboxUrl = sandbox.url;
        
        console.log(`Created sandbox ${sandbox.id} for visualization`);
      } catch (sandboxError) {
        console.warn('Failed to create sandbox, falling back to iframe:', sandboxError);
        // Don't fail the entire request if sandbox creation fails
        // The client can still use iframe rendering as fallback
      }
      
      return Response.json(result);
    }

    return Response.json({
      error: 'Unexpected response format from AI'
    }, { status: 500 });

  } catch (error) {
    console.error('Error generating visualization:', error);
    return Response.json({
      error: 'Failed to generate visualization'
    }, { status: 500 });
  }
}

function buildUserPrompt(request: VisualizationRequest): string {
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