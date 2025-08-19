import { anthropicService } from '@/services/anthropicService';

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
    // Try to use real AI service if configured
    if (anthropicService.isConfigured()) {
      try {
        return await anthropicService.generateVisualization({
          apiData,
          prompt,
        });
      } catch (error) {
        console.error('AI generation failed, falling back to mock:', error);
        // Fall through to mock implementation
      }
    }
    
    // Fallback to mock implementation
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
    // Try to use real AI service if configured
    if (anthropicService.isConfigured()) {
      try {
        return await anthropicService.generateVisualization({
          apiData,
          prompt: iterationPrompt,
          currentCode: {
            html: currentCode.html,
            css: currentCode.css,
            javascript: currentCode.javascript
          }
        });
      } catch (error) {
        console.error('AI iteration failed, falling back to mock:', error);
        // Fall through to mock implementation
      }
    }
    
    // Fallback to mock implementation
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
      ? `${dataSourceName} - ${prompt.charAt(0).toUpperCase() + prompt.slice(0, 20)}${prompt.length > 20 ? '...' : ''}`
      : dataSourceName;
    
    return `<nav class="navbar">
  <div class="nav-brand">
    <span class="brand-icon">📊</span>
    <span class="brand-text">DataViz Studio</span>
  </div>
  <div class="nav-actions">
    <button class="refresh-btn" onclick="drawChart()">Refresh</button>
  </div>
</nav>

<main class="main-content">
  <div class="hero-section">
    <h1 class="hero-title">${title}</h1>
    <div class="data-stats">
      <div class="stat-card">
        <span class="stat-label">Data Source</span>
        <span class="stat-value">${new URL(apiData.url).hostname}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Records</span>
        <span class="stat-value" id="totalRecords">${apiData.structure.totalRecords}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Showing</span>
        <span class="stat-value" id="currentRecords">${Math.min(10, apiData.structure.totalRecords)}</span>
      </div>
    </div>
  </div>
  
  <div class="controls-panel">
    <div class="controls-header">
      <h3>Visualization Controls</h3>
      <span class="controls-subtitle">Customize your data view in real-time</span>
    </div>
    <div class="controls-grid">
      <div class="control-group">
        <label for="dataPointsSlider">Data Points: <span id="dataPointsValue">10</span></label>
        <input type="range" id="dataPointsSlider" min="1" max="${apiData.structure.totalRecords}" value="10" class="slider">
      </div>
      <div class="control-group">
        <label for="sortSelect">Sort By:</label>
        <select id="sortSelect" class="control-select">
          <option value="original">Original Order</option>
          <option value="asc">Value (Low to High)</option>
          <option value="desc">Value (High to Low)</option>
          <option value="label">Label (A-Z)</option>
        </select>
      </div>
      <div class="control-group">
        <label for="colorScheme">Color Scheme:</label>
        <select id="colorScheme" class="control-select">
          <option value="gradient">Gradient</option>
          <option value="vibrant">Vibrant</option>
          <option value="pastel">Pastel</option>
          <option value="monochrome">Monochrome</option>
        </select>
      </div>
      <div class="control-group">
        <label for="animationToggle">
          <input type="checkbox" id="animationToggle" checked> Animations
        </label>
      </div>
    </div>
  </div>
  
  <div class="visualization-panel">
    <div class="panel-header">
      <h2>Interactive Data Visualization</h2>
      <div class="panel-controls">
        <button class="control-btn active" data-view="chart">Chart View</button>
        <button class="control-btn" data-view="table">Data Table</button>
        <button class="export-btn" onclick="exportChart()">Export PNG</button>
      </div>
    </div>
    <div class="chart-wrapper">
      <canvas id="dataChart" width="900" height="500"></canvas>
    </div>
    <div class="data-table-wrapper" id="dataTable" style="display: none;">
      <table class="data-table">
        <thead id="tableHead"></thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  </div>
</main>

<footer class="footer">
  <p>Generated with AI • <a href="${apiData.url}" target="_blank" rel="noopener">View Original Data</a></p>
</footer>`;
  }

  private static generateCSS(): string {
    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);
  color: #2d3748;
  min-height: 100vh;
  line-height: 1.6;
}

/* Navigation */
.navbar {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-icon {
  font-size: 1.5rem;
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #4a5568;
  letter-spacing: -0.025em;
}

.refresh-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.refresh-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Main Content */
.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  color: #2d3748;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.data-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat-card {
  background: linear-gradient(135deg, #f7fafc, #edf2f7);
  padding: 1.5rem;
  border-radius: 16px;
  text-align: center;
  min-width: 200px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #718096;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #4a5568;
}

/* Controls Panel */
.controls-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.controls-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.controls-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
}

.controls-subtitle {
  font-size: 0.875rem;
  color: #718096;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  align-items: end;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 500;
  color: #4a5568;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e0);
  outline: none;
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.control-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  background: white;
  color: #4a5568;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-select:hover {
  border-color: #a0aec0;
}

.control-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.export-btn {
  background: linear-gradient(135deg, #48bb78, #38a169);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.export-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
}

/* Data Table */
.data-table-wrapper {
  padding: 1rem;
  max-height: 500px;
  overflow: auto;
  background: #fafafa;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th {
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  font-weight: 600;
  color: #2d3748;
  position: sticky;
  top: 0;
}

.data-table tr:hover {
  background: #f7fafc;
}

/* Visualization Panel */
.visualization-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.panel-header {
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  padding: 1.5rem 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.panel-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
}

.panel-controls {
  display: flex;
  gap: 0.5rem;
}

.control-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #cbd5e0;
  background: white;
  color: #4a5568;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.control-btn:hover {
  background: #f7fafc;
  border-color: #a0aec0;
}

.control-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: transparent;
}

.chart-wrapper {
  padding: 2rem;
  background: #fafafa;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 500px;
}

#dataChart {
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  background: white;
}

/* Footer */
.footer {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
  margin-top: 3rem;
}

.footer a {
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-weight: 500;
}

.footer a:hover {
  color: white;
  text-decoration: underline;
}

/* Responsive Design */
@media (max-width: 768px) {
  .navbar {
    padding: 1rem;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .hero-title {
    font-size: 2rem;
  }
  
  .data-stats {
    flex-direction: column;
    align-items: center;
  }
  
  .panel-header {
    flex-direction: column;
    text-align: center;
  }
  
  .chart-wrapper {
    padding: 1rem;
  }
  
  #dataChart {
    max-width: 100%;
    height: auto;
  }
}

/* Animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-section,
.visualization-panel {
  animation: fadeInUp 0.6s ease-out;
}`;
  }

  private static generateJavaScript(sampleData: any[], structure: any): string {
    return `// Enhanced Interactive Data Visualization Script
const canvas = document.getElementById('dataChart');
const ctx = canvas.getContext('2d');

// Full dataset from API
const fullData = ${JSON.stringify(sampleData, null, 2)};
let currentData = [...fullData];
let displayCount = Math.min(10, fullData.length);
let sortMode = 'original';
let colorScheme = 'gradient';
let animationsEnabled = true;

// Set canvas size for better quality
const dpr = window.devicePixelRatio || 1;
canvas.width = 900 * dpr;
canvas.height = 500 * dpr;
canvas.style.width = '900px';
canvas.style.height = '500px';
ctx.scale(dpr, dpr);

// Color palettes
const colorPalettes = {
  gradient: [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
    '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
  ],
  vibrant: [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
    '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
    '#00d2d3', '#ff9f43', '#10ac84', '#ee5a6f'
  ],
  pastel: [
    '#ffd3e1', '#c8f7c5', '#b4d5ff', '#f9ca89',
    '#f3d3f7', '#b8e6b8', '#ffb3ba', '#bae1ff',
    '#ffffba', '#ffdfba', '#e0bbe4', '#d4edda'
  ],
  monochrome: [
    '#1a1a1a', '#333333', '#4d4d4d', '#666666',
    '#808080', '#999999', '#b3b3b3', '#cccccc',
    '#e6e6e6', '#f0f0f0', '#f7f7f7', '#fdfdfd'
  ]
};

// Data manipulation functions
function sortData(data, mode) {
  const keys = Object.keys(data[0] || {});
  const numericKey = keys.find(key => typeof data[0][key] === 'number');
  const labelKey = keys.find(key => typeof data[0][key] === 'string') || keys[0];
  
  switch(mode) {
    case 'asc':
      return numericKey ? [...data].sort((a, b) => (a[numericKey] || 0) - (b[numericKey] || 0)) : data;
    case 'desc':
      return numericKey ? [...data].sort((a, b) => (b[numericKey] || 0) - (a[numericKey] || 0)) : data;
    case 'label':
      return labelKey ? [...data].sort((a, b) => String(a[labelKey]).localeCompare(String(b[labelKey]))) : data;
    default:
      return data;
  }
}

function updateCurrentData() {
  let processedData = sortData(fullData, sortMode);
  currentData = processedData.slice(0, displayCount);
  
  // Update UI counters
  document.getElementById('currentRecords').textContent = currentData.length;
  document.getElementById('dataPointsValue').textContent = displayCount;
  
  // Redraw chart and table
  drawChart();
  updateDataTable();
}

// Enhanced chart drawing function
function drawChart() {
  const padding = 80;
  const chartWidth = 900 - 2 * padding;
  const chartHeight = 500 - 2 * padding;
  
  // Clear with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 900, 500);
  
  // Draw subtle grid
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 10; i++) {
    const y = padding + (chartHeight / 10) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(900 - padding, y);
    ctx.stroke();
  }
  
  // Draw axes with modern style
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 2;
  
  // Y-axis
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, 500 - padding);
  ctx.stroke();
  
  // X-axis
  ctx.beginPath();
  ctx.moveTo(padding, 500 - padding);
  ctx.lineTo(900 - padding, 500 - padding);
  ctx.stroke();
  
  if (currentData.length > 0) {
    const keys = Object.keys(currentData[0]);
    const numericKey = keys.find(key => typeof currentData[0][key] === 'number');
    const labelKey = keys.find(key => typeof currentData[0][key] === 'string') || keys[0];
    
    if (numericKey) {
      // Enhanced bar chart with current data
      const maxValue = Math.max(...currentData.map(item => item[numericKey] || 0));
      const barWidth = Math.min(chartWidth / currentData.length * 0.7, 60);
      const barSpacing = (chartWidth - barWidth * currentData.length) / (currentData.length + 1);
      
      // Y-axis labels with better styling
      ctx.fillStyle = '#4a5568';
      ctx.font = '12px Segoe UI';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      for (let i = 0; i <= 5; i++) {
        const value = (maxValue / 5) * i;
        const y = 500 - padding - (chartHeight / 5) * i;
        ctx.fillText(Math.round(value).toLocaleString(), padding - 10, y);
      }
      
      // Y-axis title
      ctx.save();
      ctx.translate(25, 500 / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Segoe UI';
      ctx.fillStyle = '#2d3748';
      ctx.fillText(numericKey.charAt(0).toUpperCase() + numericKey.slice(1), 0, 0);
      ctx.restore();
      
      // X-axis title
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 14px Segoe UI';
      ctx.fillStyle = '#2d3748';
      ctx.fillText(labelKey.charAt(0).toUpperCase() + labelKey.slice(1), 900 / 2, 500 - 25);
      
      // Get current color palette
      const colors = colorPalettes[colorScheme];
      
      // Draw enhanced bars
      currentData.forEach((item, index) => {
        const value = item[numericKey] || 0;
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + barSpacing + index * (barWidth + barSpacing);
        const y = 500 - padding - barHeight;
        
        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        let color1, color2;
        
        if (colorScheme === 'monochrome') {
          color1 = colors[index % colors.length];
          color2 = colors[Math.min(index + 1, colors.length - 1)];
        } else {
          color1 = colors[index % colors.length];
          color2 = colors[(index + 1) % colors.length];
        }
        
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        
        // Draw bar with rounded corners
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();
        
        // Add subtle shadow if animations enabled
        if (animationsEnabled) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
        }
        
        // X-axis labels with better formatting
        ctx.fillStyle = '#4a5568';
        ctx.font = '11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = String(item[labelKey]).substring(0, 10);
        ctx.fillText(label, x + barWidth / 2, 500 - padding + 8);
        
        // Value labels on bars
        ctx.fillStyle = '#2d3748';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textBaseline = 'bottom';
        ctx.fillText(value.toLocaleString(), x + barWidth / 2, y - 8);
      });
    } else {
      // Enhanced fallback display
      ctx.fillStyle = '#4a5568';
      ctx.font = '28px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📊 Data Successfully Loaded', 450, 220);
      
      ctx.font = '18px Segoe UI';
      ctx.fillStyle = '#718096';
      ctx.fillText(\`\${currentData.length} records ready for visualization\`, 450, 260);
      
      ctx.font = '14px Segoe UI';
      ctx.fillText('Numeric data not detected - showing summary instead', 450, 300);
    }
  }
}

// Data table functionality
function updateDataTable() {
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');
  
  if (currentData.length === 0) return;
  
  // Create table headers
  const keys = Object.keys(currentData[0]);
  tableHead.innerHTML = '<tr>' + keys.map(key => \`<th>\${key}</th>\`).join('') + '</tr>';
  
  // Create table rows
  tableBody.innerHTML = currentData.map(item => 
    '<tr>' + keys.map(key => \`<td>\${item[key] || ''}</td>\`).join('') + '</tr>'
  ).join('');
}

// Export functionality
function exportChart() {
  const link = document.createElement('a');
  link.download = 'data-visualization.png';
  link.href = canvas.toDataURL();
  link.click();
}

// Add CanvasRenderingContext2D.roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radii) {
    const radius = Array.isArray(radii) ? radii[0] : radii;
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.arcTo(x + width, y, x + width, y + radius, radius);
    this.lineTo(x + width, y + height - radius);
    this.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    this.lineTo(x + radius, y + height);
    this.arcTo(x, y + height, x, y + height - radius, radius);
    this.lineTo(x, y + radius);
    this.arcTo(x, y, x + radius, y, radius);
    this.closePath();
  };
}

// Enhanced interactivity
let hoveredBar = -1;

canvas.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * (900 / rect.width);
  const mouseY = (e.clientY - rect.top) * (500 / rect.height);
  
  if (currentData.length > 0) {
    const keys = Object.keys(currentData[0]);
    const numericKey = keys.find(key => typeof currentData[0][key] === 'number');
    
    if (numericKey) {
      const padding = 80;
      const chartWidth = 900 - 2 * padding;
      const barWidth = Math.min(chartWidth / currentData.length * 0.7, 60);
      const barSpacing = (chartWidth - barWidth * currentData.length) / (currentData.length + 1);
      
      hoveredBar = -1;
      currentData.forEach((item, index) => {
        const x = padding + barSpacing + index * (barWidth + barSpacing);
        if (mouseX >= x && mouseX <= x + barWidth) {
          hoveredBar = index;
        }
      });
      
      drawChart();
      
      // Draw hover effect
      if (hoveredBar >= 0) {
        const item = currentData[hoveredBar];
        const value = item[numericKey] || 0;
        const maxValue = Math.max(...currentData.map(item => item[numericKey] || 0));
        const barHeight = (value / maxValue) * (500 - 2 * padding);
        const x = padding + barSpacing + hoveredBar * (barWidth + barSpacing);
        const y = 500 - padding - barHeight;
        
        // Highlight effect
        ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
        ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
        
        // Tooltip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(mouseX + 10, mouseY - 40, 120, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText(\`Value: \${value.toLocaleString()}\`, mouseX + 15, mouseY - 20);
      }
    }
  }
});

canvas.addEventListener('mouseleave', function() {
  hoveredBar = -1;
  drawChart();
});

// Control event listeners
document.getElementById('dataPointsSlider').addEventListener('input', function(e) {
  displayCount = parseInt(e.target.value);
  updateCurrentData();
});

document.getElementById('sortSelect').addEventListener('change', function(e) {
  sortMode = e.target.value;
  updateCurrentData();
});

document.getElementById('colorScheme').addEventListener('change', function(e) {
  colorScheme = e.target.value;
  drawChart();
});

document.getElementById('animationToggle').addEventListener('change', function(e) {
  animationsEnabled = e.target.checked;
  drawChart();
});

// View switching
document.querySelectorAll('.control-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', function() {
    const view = this.dataset.view;
    
    // Update active state
    document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    
    // Show/hide content
    if (view === 'chart') {
      document.querySelector('.chart-wrapper').style.display = 'flex';
      document.getElementById('dataTable').style.display = 'none';
    } else if (view === 'table') {
      document.querySelector('.chart-wrapper').style.display = 'none';
      document.getElementById('dataTable').style.display = 'block';
      updateDataTable();
    }
  });
});

// Initialize
setTimeout(() => {
  updateCurrentData();
}, 100);

console.log('🎨 Interactive visualization loaded with', fullData.length, 'total data points');`;
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