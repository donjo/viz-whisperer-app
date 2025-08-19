/// <reference lib="deno.ns" />

// Debug endpoint to help understand frontend-backend communication
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  if (req.method === 'GET') {
    // Return debug information about current state
    return Response.json({
      message: 'Frontend Debug Endpoint',
      instructions: {
        test1: 'POST /api/debug-frontend with {"action": "test-response"} to simulate successful generation',
        test2: 'POST /api/debug-frontend with {"action": "test-monitoring"} to test status monitoring',
        test3: 'Check browser console for frontend errors',
        test4: 'Check Network tab in DevTools for API calls'
      },
      tips: [
        'Make sure your frontend component extracts visualizationId from API response',
        'Check that PreviewWindow receives generatedCode.visualizationId',
        'Verify deployment-status API calls are being made'
      ]
    });
  }
  
  if (req.method === 'POST') {
    const body = await req.json();
    
    if (body.action === 'test-response') {
      // Simulate a successful generate-visualization response
      return Response.json({
        html: '<div>Debug Test</div>',
        css: 'body { background: #000; color: #fff; }',
        javascript: 'console.log("Debug test visualization");',
        fullCode: '<!DOCTYPE html><html><head><style>body { background: #000; color: #fff; }</style></head><body><div>Debug Test</div><script>console.log("Debug test visualization");</script></body></html>',
        visualizationId: 'debug-' + crypto.randomUUID(),
        sandboxId: 'debug-sandbox-123',
        sandboxUrl: 'https://debug.example.com',
        _debug: {
          message: 'This is a debug response - check if your frontend receives visualizationId',
          timestamp: new Date().toISOString(),
          tip: 'Look for visualizationId in the response and ensure it gets passed to PreviewWindow'
        }
      });
    }
    
    if (body.action === 'test-monitoring') {
      const testId = body.visualizationId || 'debug-test-123';
      return Response.json({
        visualizationId: testId,
        status: 'ready',
        startTime: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
        endTime: new Date().toISOString(),
        sandboxUrl: 'https://debug-monitoring.example.com',
        events: [
          {
            id: 'debug-1',
            timestamp: new Date(Date.now() - 25000).toISOString(),
            stage: 'generation',
            message: 'Debug: AI generation complete'
          },
          {
            id: 'debug-2', 
            timestamp: new Date(Date.now() - 15000).toISOString(),
            stage: 'deployment',
            message: 'Debug: Deploying to sandbox'
          },
          {
            id: 'debug-3',
            timestamp: new Date().toISOString(),
            stage: 'ready',
            message: 'Debug: Deployment ready for testing'
          }
        ],
        _debug: {
          message: 'This simulates a successful deployment status response',
          tip: 'Use this to test if your frontend monitoring logic works'
        }
      });
    }
    
    return Response.json({ error: 'Unknown debug action' }, { status: 400 });
  }
  
  return new Response('Method not allowed', { status: 405 });
}