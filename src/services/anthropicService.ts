import Anthropic from '@anthropic-ai/sdk';

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
}

class AnthropicService {
  private client: Anthropic | null = null;
  
  constructor() {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    
    if (apiKey && apiKey !== 'your_api_key_here') {
      this.client = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }
  
  isConfigured(): boolean {
    return this.client !== null;
  }
  
  async generateVisualization(request: VisualizationRequest): Promise<GeneratedCode> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env.local file');
    }
    
    const systemPrompt = `You are an expert data visualization developer. Generate complete, working HTML/CSS/JavaScript code for interactive data visualizations.

    REQUIREMENTS:
    - Create a COMPLETE working visualization (not just setup code)
    - Use HTML5 Canvas or SVG for actual chart rendering
    - Include ALL necessary JavaScript to draw the visualization
    - Use vanilla JavaScript only (no external libraries)
    - Make it responsive and interactive
    - Include proper error handling
    - Add hover effects and animations

    CRITICAL FORMAT REQUIREMENTS:
    - Return ONLY valid JSON with no extra text
    - CSS must be properly escaped (no raw newlines)
    - JavaScript must include complete chart drawing logic
    - HTML must include container elements for the chart

    Example structure for bar chart:
    {
      "html": "<div class='chart-container'><canvas id='chart' width='800' height='600'></canvas><div class='tooltip'></div></div>",
      "css": "body { margin: 0; font-family: Arial; } .chart-container { position: relative; padding: 20px; } canvas { border: 1px solid #ddd; }",
      "javascript": "const canvas = document.getElementById('chart'); const ctx = canvas.getContext('2d'); /* COMPLETE CHART DRAWING CODE HERE */ function drawChart() { /* actual drawing logic */ } drawChart();"
    }

    YOU MUST INCLUDE:
    - Complete chart drawing functions
    - Data rendering logic  
    - Canvas or SVG manipulation code
    - Event handlers for interactivity

    Return ONLY the JSON object:`;
    
    const userPrompt = this.buildUserPrompt(request);
    
    try {
      const response = await this.client.messages.create({
        model: import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });
      
      const content = response.content[0];
      if (content.type === 'text') {
        const parsed = this.parseResponse(content.text);
        const validated = this.validateAndFixCode(parsed, request);
        return {
          ...validated,
          fullCode: this.combineCode(validated.html, validated.css, validated.javascript)
        };
      }
      
      throw new Error('Unexpected response format from AI');
    } catch (error) {
      console.error('Error generating visualization:', error);
      throw error;
    }
  }
  
  private buildUserPrompt(request: VisualizationRequest): string {
    const { apiData, prompt, currentCode } = request;
    
    let userPrompt = `Create a data visualization with the following specifications:
    
    Data Source: ${apiData.url}
    Total Records: ${apiData.structure.totalRecords}
    
    Data Structure:
    ${apiData.structure.fields.map(field => 
      `- ${field.name} (${field.type}): ${JSON.stringify(field.sample)}`
    ).join('\n')}
    
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
  
  private parseResponse(text: string): Omit<GeneratedCode, 'fullCode'> {
    console.log('Raw AI response:', text); // Debug logging
    
    try {
      // Method 1: Try multiple JSON extraction patterns
      const jsonPatterns = [
        /\{[\s\S]*"javascript"[\s\S]*\}/,  // Look for complete JSON with all fields
        /\{[\s\S]*\}/,                     // Fallback to any JSON-like structure
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
                javascript: parsed.javascript
              };
            }
          } catch (jsonError) {
            console.warn('JSON parse failed for pattern:', pattern);
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
          /<div[\s\S]*<\/div>/i
        ],
        css: [
          /```css\n([\s\S]*?)```/,
          /```CSS\n([\s\S]*?)```/,
          /<style>([\s\S]*?)<\/style>/i,
          /\.[\w-]+\s*\{[\s\S]*?\}/
        ],
        javascript: [
          /```javascript\n([\s\S]*?)```/,
          /```js\n([\s\S]*?)```/,
          /```JavaScript\n([\s\S]*?)```/,
          /<script>([\s\S]*?)<\/script>/i,
          /function[\s\S]*?\}/,
          /const\s+\w+[\s\S]*?;/
        ]
      };
      
      const extractCode = (patterns: RegExp[]): string => {
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            return match[1] || match[0];
          }
        }
        return '';
      };
      
      const html = extractCode(codeBlockPatterns.html);
      const css = extractCode(codeBlockPatterns.css);
      const javascript = extractCode(codeBlockPatterns.javascript);
      
      if (html || css || javascript) {
        return {
          html: html || '<div id="chart">Visualization will appear here</div>',
          css: css || '#chart { padding: 20px; text-align: center; }',
          javascript: javascript || 'console.log("Visualization ready");'
        };
      }
      
      // Method 3: Last resort - generate a basic chart based on the response text
      return this.generateFallbackVisualization(text);
      
    } catch (error) {
      console.error('Error parsing AI response:', error, 'Response text:', text);
      return this.generateFallbackVisualization('Parsing error occurred');
    }
  }
  
  private validateAndFixCode(code: Omit<GeneratedCode, 'fullCode'>, request: VisualizationRequest): Omit<GeneratedCode, 'fullCode'> {
    const issues: string[] = [];
    
    // Check if code is too minimal
    if (code.html.length < 50) {
      issues.push('HTML too short');
    }
    
    if (code.css.length < 30) {
      issues.push('CSS too short');
    }
    
    if (code.javascript.length < 100) {
      issues.push('JavaScript too short');
    }
    
    // Check for common issues
    if (!code.javascript.includes('canvas') && !code.javascript.includes('svg') && !code.javascript.includes('Chart')) {
      issues.push('No chart drawing code detected');
    }
    
    if (code.css.includes('\\n')) {
      issues.push('CSS contains unescaped newlines');
      code.css = code.css.replace(/\\n/g, ' ');
    }
    
    // If there are critical issues, generate a working fallback
    if (issues.length > 2 || issues.includes('No chart drawing code detected')) {
      console.warn('Generated code has issues, creating fallback:', issues);
      return this.generateWorkingVisualization(request);
    }
    
    return code;
  }
  
  private generateWorkingVisualization(request: VisualizationRequest): Omit<GeneratedCode, 'fullCode'> {
    const { apiData } = request;
    const sampleData = Array.isArray(apiData.data) ? apiData.data.slice(0, 10) : [apiData.data];
    
    // Find numeric and label fields
    const fields = apiData.structure.fields;
    const numericField = fields.find(f => f.type === 'number');
    const labelField = fields.find(f => f.type === 'string') || fields[0];
    
    if (!numericField) {
      return this.generateFallbackVisualization('No numeric data found for visualization');
    }
    
    return {
      html: `
        <div class="chart-container">
          <h2 class="chart-title">Data Visualization</h2>
          <canvas id="dataChart" width="800" height="500"></canvas>
          <div class="tooltip" id="tooltip"></div>
        </div>
      `,
      css: `
        body { 
          margin: 0; 
          padding: 20px; 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .chart-container { 
          background: white; 
          border-radius: 12px; 
          padding: 30px; 
          box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
          max-width: 900px; 
          margin: 0 auto;
        }
        .chart-title { 
          text-align: center; 
          color: #333; 
          margin-bottom: 20px; 
          font-size: 24px;
        }
        #dataChart { 
          display: block; 
          margin: 0 auto; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .tooltip { 
          position: absolute; 
          background: rgba(0,0,0,0.8); 
          color: white; 
          padding: 8px 12px; 
          border-radius: 4px; 
          font-size: 12px; 
          pointer-events: none; 
          opacity: 0; 
          transition: opacity 0.2s;
        }
      `,
      javascript: `
        const canvas = document.getElementById('dataChart');
        const ctx = canvas.getContext('2d');
        const tooltip = document.getElementById('tooltip');
        
        const data = ${JSON.stringify(sampleData)};
        const numericField = '${numericField.name}';
        const labelField = '${labelField.name}';
        
        // Chart dimensions
        const padding = 60;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;
        
        // Extract and prepare data
        const chartData = data.map(item => ({
          label: String(item[labelField] || 'Unknown').substring(0, 15),
          value: Number(item[numericField]) || 0
        })).filter(item => item.value > 0);
        
        const maxValue = Math.max(...chartData.map(d => d.value));
        const barWidth = chartWidth / chartData.length * 0.8;
        const barSpacing = chartWidth / chartData.length * 0.2;
        
        // Colors
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
          '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
        ];
        
        function drawChart() {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw background
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw grid lines
          ctx.strokeStyle = '#e0e0e0';
          ctx.lineWidth = 1;
          for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
          }
          
          // Draw bars
          chartData.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const x = padding + index * (barWidth + barSpacing);
            const y = canvas.height - padding - barHeight;
            
            // Bar gradient
            const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
            const color = colors[index % colors.length];
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, color + '80');
            
            // Draw bar
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Bar outline
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, barWidth, barHeight);
            
            // Value label on bar
            ctx.fillStyle = '#333';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.value.toLocaleString(), x + barWidth/2, y - 5);
            
            // Label below bar
            ctx.save();
            ctx.translate(x + barWidth/2, canvas.height - padding + 15);
            ctx.rotate(-Math.PI/4);
            ctx.fillStyle = '#666';
            ctx.font = '11px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(item.label, 0, 0);
            ctx.restore();
          });
          
          // Y-axis labels
          ctx.fillStyle = '#666';
          ctx.font = '12px Arial';
          ctx.textAlign = 'right';
          for (let i = 0; i <= 5; i++) {
            const value = (maxValue / 5) * (5 - i);
            const y = padding + (chartHeight / 5) * i;
            ctx.fillText(Math.round(value).toLocaleString(), padding - 10, y + 4);
          }
          
          // Title
          ctx.fillStyle = '#333';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('${labelField} vs ${numericField}', canvas.width/2, 30);
        }
        
        // Mouse interaction
        canvas.addEventListener('mousemove', (e) => {
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          // Check if hovering over a bar
          const barIndex = Math.floor((mouseX - padding) / (barWidth + barSpacing));
          if (barIndex >= 0 && barIndex < chartData.length) {
            const item = chartData[barIndex];
            const barX = padding + barIndex * (barWidth + barSpacing);
            const barHeight = (item.value / maxValue) * chartHeight;
            const barY = canvas.height - padding - barHeight;
            
            if (mouseX >= barX && mouseX <= barX + barWidth && mouseY >= barY && mouseY <= barY + barHeight) {
              // Show tooltip
              tooltip.style.left = (e.clientX + 10) + 'px';
              tooltip.style.top = (e.clientY - 10) + 'px';
              tooltip.innerHTML = \`<strong>\${item.label}</strong><br>\${numericField}: \${item.value.toLocaleString()}\`;
              tooltip.style.opacity = '1';
              canvas.style.cursor = 'pointer';
              return;
            }
          }
          
          // Hide tooltip
          tooltip.style.opacity = '0';
          canvas.style.cursor = 'default';
        });
        
        canvas.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
          canvas.style.cursor = 'default';
        });
        
        // Draw initial chart
        drawChart();
        
        // Add some animation
        setTimeout(() => {
          canvas.style.transition = 'transform 0.2s ease';
        }, 100);
        
        console.log('Chart rendered with', chartData.length, 'data points');
      `
    };
  }

  private generateFallbackVisualization(responseText: string): Omit<GeneratedCode, 'fullCode'> {
    return {
      html: `
        <div class="error-container">
          <h2>⚠️ Parsing Error</h2>
          <p>The AI response couldn't be parsed correctly. Please try again with a simpler prompt.</p>
          <details>
            <summary>Raw Response (click to expand)</summary>
            <pre>${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}</pre>
          </details>
          <button onclick="location.reload()">Try Again</button>
        </div>
      `,
      css: `
        .error-container {
          padding: 2rem;
          margin: 2rem;
          border: 2px dashed #ff6b6b;
          border-radius: 8px;
          background: #ffe0e0;
          text-align: center;
          font-family: system-ui, sans-serif;
        }
        .error-container h2 {
          color: #d63031;
          margin-bottom: 1rem;
        }
        .error-container button {
          background: #74b9ff;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 1rem;
        }
        .error-container pre {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 4px;
          overflow: auto;
          text-align: left;
          font-size: 0.8rem;
        }
      `,
      javascript: `
        console.error('AI response parsing failed');
        console.log('Consider simplifying your prompt or trying again');
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