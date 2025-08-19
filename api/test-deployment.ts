/// <reference lib="deno.ns" />
import { sandboxService } from "../src/services/sandboxService.ts";
import { deploymentLogger } from "../src/services/deploymentLogger.ts";

// Test visualization payload - a simple interactive bar chart
const TEST_VISUALIZATION = {
  html: `<div id="chart-container">
    <h2 id="chart-title">Sample Data Visualization</h2>
    <canvas id="barChart" width="800" height="500"></canvas>
    <div id="tooltip" style="position: absolute; background: #333; color: white; padding: 8px; border-radius: 4px; display: none; pointer-events: none; z-index: 1000;"></div>
  </div>`,
  
  css: `body {
    background: #0f0f23;
    color: #e2e8f0;
    margin: 0;
    font-family: Arial, sans-serif;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  #chart-container {
    text-align: center;
    position: relative;
  }
  
  #chart-title {
    margin-bottom: 20px;
    color: #60a5fa;
  }
  
  #barChart {
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: crosshair;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  #barChart:hover {
    border-color: #60a5fa;
  }`,
  
  javascript: `// Test Data
const testData = [
  { name: 'Apples', value: 45, color: '#ff6b6b' },
  { name: 'Bananas', value: 30, color: '#4ecdc4' },
  { name: 'Oranges', value: 25, color: '#45b7d1' },
  { name: 'Grapes', value: 35, color: '#f9ca24' },
  { name: 'Berries', value: 40, color: '#6c5ce7' }
];

const canvas = document.getElementById('barChart');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

// Chart configuration
const padding = 60;
const chartWidth = canvas.width - 2 * padding;
const chartHeight = canvas.height - 2 * padding;
const maxValue = Math.max(...testData.map(d => d.value));
const barWidth = chartWidth / testData.length * 0.7;
const barSpacing = chartWidth / testData.length * 0.3;

// Animation variables
let animationProgress = 0;
const animationDuration = 1500;
let startTime = null;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawChart(progress = 1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Interactive Bar Chart - Test Deployment', canvas.width / 2, 30);
  
  // Draw grid lines
  ctx.strokeStyle = '#374151';
  ctx.globalAlpha = 0.3;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i / 5) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  
  // Draw axes
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();
  
  // Draw Y-axis labels
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const y = canvas.height - padding - (i / 5) * chartHeight;
    const value = Math.round((maxValue / 5) * i);
    ctx.fillText(value, padding - 10, y + 4);
  }
  
  // Draw bars with animation
  testData.forEach((item, index) => {
    const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
    const fullBarHeight = (item.value / maxValue) * chartHeight;
    const barHeight = fullBarHeight * progress;
    const y = canvas.height - padding - barHeight;
    
    // Draw bar
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Draw bar outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Draw X-axis labels
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + barWidth / 2, canvas.height - padding + 20);
    
    // Draw value labels (only if animation is complete)
    if (progress > 0.8) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(item.value, x + barWidth / 2, y - 5);
    }
  });
}

function animate(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = timestamp - startTime;
  animationProgress = Math.min(elapsed / animationDuration, 1);
  
  const easedProgress = easeOutCubic(animationProgress);
  drawChart(easedProgress);
  
  if (animationProgress < 1) {
    requestAnimationFrame(animate);
  }
}

// Mouse interaction
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  let hoveredBar = null;
  testData.forEach((item, index) => {
    const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
    const barHeight = (item.value / maxValue) * chartHeight;
    const y = canvas.height - padding - barHeight;
    
    if (mouseX >= x && mouseX <= x + barWidth && mouseY >= y && mouseY <= canvas.height - padding) {
      hoveredBar = { item, clientX: e.clientX, clientY: e.clientY };
    }
  });
  
  if (hoveredBar) {
    tooltip.style.left = hoveredBar.clientX + 10 + 'px';
    tooltip.style.top = hoveredBar.clientY - 30 + 'px';
    tooltip.innerHTML = '<strong>' + hoveredBar.item.name + '</strong><br/>Value: ' + hoveredBar.item.value;
    tooltip.style.display = 'block';
  } else {
    tooltip.style.display = 'none';
  }
});

canvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
});

// Start animation
requestAnimationFrame(animate);

// Add deployment test indicator
setTimeout(() => {
  const indicator = document.createElement('div');
  indicator.innerHTML = '✅ Sandbox deployment test successful!';
  indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #10b981; color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; z-index: 9999;';
  document.body.appendChild(indicator);
  setTimeout(() => indicator.remove(), 5000);
}, 2000);`
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed. Use POST to trigger test deployment.', { status: 405 });
  }

  try {
    // Create a test visualization ID
    const testVisualizationId = `test-${crypto.randomUUID()}`;
    
    console.log(`🧪 Starting test deployment for: ${testVisualizationId}`);
    
    // Start deployment logging
    const deploymentLog = deploymentLogger.startDeployment(testVisualizationId);
    deploymentLogger.logEvent(testVisualizationId, 'generation', 'Using pre-built test visualization payload');
    
    // Create sandbox deployment directly
    const sandbox = await sandboxService.createVisualization(
      TEST_VISUALIZATION, 
      testVisualizationId
    );
    
    const result = {
      success: true,
      message: 'Test deployment completed',
      visualizationId: testVisualizationId,
      sandboxId: sandbox.id,
      sandboxUrl: sandbox.url,
      testPayload: {
        htmlLength: TEST_VISUALIZATION.html.length,
        cssLength: TEST_VISUALIZATION.css.length,
        jsLength: TEST_VISUALIZATION.javascript.length,
        features: [
          'Interactive bar chart',
          'Mouse hover tooltips', 
          'Animated rendering',
          'Custom colors',
          'Responsive design'
        ]
      },
      instructions: {
        checkStatus: `GET /api/deployment-status?id=${testVisualizationId}`,
        testUrl: sandbox.url,
        debugInfo: 'Check console logs for detailed deployment steps'
      }
    };
    
    console.log(`🎯 Test deployment successful: ${sandbox.url}`);
    
    return Response.json(result, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('🚫 Test deployment failed:', error);
    
    return Response.json({
      success: false,
      error: 'Test deployment failed',
      message: errorMessage,
      suggestion: 'Check that DENO_DEPLOY_TOKEN is properly configured'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }
}