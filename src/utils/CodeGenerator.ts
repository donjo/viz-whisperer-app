// Mock code generation service
// In a real implementation, this would integrate with OpenAI, Claude, or another AI service

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
}

export class CodeGenerator {
  static async generateVisualization(
    apiData: ApiData,
    prompt: string
  ): Promise<GeneratedCode> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract sample data for visualization
    const sampleData = Array.isArray(apiData.data) 
      ? apiData.data.slice(0, 10) 
      : [apiData.data];

    // Generate basic visualization based on data structure
    const html = this.generateHTML(apiData, prompt);
    const css = this.generateCSS();
    const javascript = this.generateJavaScript(sampleData, apiData.structure);
    const fullCode = this.combineCode(html, css, javascript);

    return { html, css, javascript, fullCode };
  }

  static async iterateVisualization(
    currentCode: GeneratedCode,
    iterationPrompt: string,
    apiData: ApiData
  ): Promise<GeneratedCode> {
    // Simulate iteration delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real implementation, this would send the current code + iteration request to AI
    // For now, we'll generate a modified version
    const sampleData = Array.isArray(apiData.data) 
      ? apiData.data.slice(0, 10) 
      : [apiData.data];

    const html = this.generateHTML(apiData, iterationPrompt);
    const css = this.generateCSS();
    const javascript = this.generateJavaScript(sampleData, apiData.structure);
    const fullCode = this.combineCode(html, css, javascript);

    return { html, css, javascript, fullCode };
  }

  private static generateHTML(apiData: ApiData, prompt: string): string {
    // Generate title from data source and prompt (only if prompt is meaningful)
    const dataSourceName = apiData.url.includes('github.com') 
      ? apiData.url.split('/').slice(-2).join('/') 
      : new URL(apiData.url).hostname;
    
    // Only include prompt in title if it's descriptive and useful
    const isPromptUseful = prompt.length > 10 && 
      (prompt.toLowerCase().includes('chart') || 
       prompt.toLowerCase().includes('graph') ||
       prompt.toLowerCase().includes('show') ||
       prompt.toLowerCase().includes('display') ||
       prompt.toLowerCase().includes('visualiz'));
    
    const title = isPromptUseful 
      ? `${dataSourceName} - ${prompt.charAt(0).toUpperCase() + prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}`
      : dataSourceName;
    
    return `<div class="visualization-container">
  <div class="header">
    <h1>${title}</h1>
    <p>Source: ${apiData.url}</p>
    <p>Records: ${apiData.structure.totalRecords}</p>
  </div>
  <div class="chart-container">
    <canvas id="dataChart" width="800" height="400"></canvas>
  </div>
  <div class="data-info">
    <h3>Data Fields:</h3>
    <ul>
      ${apiData.structure.fields.map(field => 
        `<li><strong>${field.name}</strong> (${field.type}): ${field.sample}</li>`
      ).join('')}
    </ul>
  </div>
</div>`;
  }

  private static generateCSS(): string {
    return `body {
  font-family: 'Inter', system-ui, sans-serif;
  background: linear-gradient(135deg, #0a0a0f, #1a1a2e);
  color: #ffffff;
  margin: 0;
  padding: 20px;
  min-height: 100vh;
}

.visualization-container {
  max-width: 1200px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header h1 {
  color: #3b82f6;
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}

.header p {
  color: #94a3b8;
  margin: 5px 0;
}

.chart-container {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin: 30px 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

#dataChart {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}

.data-info {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 12px;
  padding: 20px;
  margin-top: 30px;
}

.data-info h3 {
  color: #22c55e;
  margin-top: 0;
  margin-bottom: 15px;
}

.data-info ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.data-info li {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.data-info li:last-child {
  border-bottom: none;
}

.data-info strong {
  color: #3b82f6;
}`;
  }

  private static generateJavaScript(sampleData: any[], structure: any): string {
    return `// Data Visualization Script
const canvas = document.getElementById('dataChart');
const ctx = canvas.getContext('2d');

// Sample data from API
const data = ${JSON.stringify(sampleData, null, 2)};

// Set canvas size
canvas.width = 800;
canvas.height = 400;

// Basic bar chart visualization
function drawChart() {
  const padding = 80; // Increased padding for axis labels
  const chartWidth = canvas.width - 2 * padding;
  const chartHeight = canvas.height - 2 * padding;
  
  // Clear canvas
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 10; i++) {
    const y = padding + (chartHeight / 10) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }
  
  // Draw axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  
  // Y-axis
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.stroke();
  
  // X-axis
  ctx.beginPath();
  ctx.moveTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();
  
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    const numericKey = keys.find(key => typeof data[0][key] === 'number');
    const labelKey = keys.find(key => typeof data[0][key] === 'string') || keys[0];
    
    if (numericKey) {
      // Draw bars
      const maxValue = Math.max(...data.map(item => item[numericKey] || 0));
      const barWidth = chartWidth / data.length * 0.8;
      const barSpacing = chartWidth / data.length * 0.2;
      
      // Y-axis labels and title
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      for (let i = 0; i <= 5; i++) {
        const value = (maxValue / 5) * i;
        const y = canvas.height - padding - (chartHeight / 5) * i;
        ctx.fillText(Math.round(value).toString(), padding - 10, y);
      }
      
      // Y-axis title
      ctx.save();
      ctx.translate(20, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Inter';
      ctx.fillText(numericKey.charAt(0).toUpperCase() + numericKey.slice(1), 0, 0);
      ctx.restore();
      
      // X-axis title
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 14px Inter';
      ctx.fillText(labelKey.charAt(0).toUpperCase() + labelKey.slice(1), canvas.width / 2, canvas.height - 20);
      
      data.forEach((item, index) => {
        const value = item[numericKey] || 0;
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
        const y = canvas.height - padding - barHeight;
        
        // Gradient fill
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#1e40af');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Glow effect
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.shadowBlur = 0;
        
        // X-axis labels (data labels)
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = String(item[labelKey]).substring(0, 8);
        ctx.fillText(label, x + barWidth / 2, canvas.height - padding + 5);
        
        // Value labels on top of bars
        ctx.textBaseline = 'bottom';
        ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
      });
    } else {
      // Fallback: draw a simple message
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Data Loaded Successfully', canvas.width / 2, canvas.height / 2);
      ctx.font = '16px Inter';
      ctx.fillText(\`\${data.length} records found\`, canvas.width / 2, canvas.height / 2 + 40);
    }
  }
}

// Initial draw
drawChart();

// Add some interactivity
canvas.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Simple hover effect - redraw with highlighting
  drawChart();
  
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
  ctx.fillRect(x - 10, y - 10, 20, 20);
});

console.log('Visualization loaded with', data.length, 'data points');`;
  }

  private static combineCode(html: string, css: string, javascript: string): string {
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