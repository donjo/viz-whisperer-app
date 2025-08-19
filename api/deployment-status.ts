/// <reference lib="deno.ns" />
import { deploymentLogger } from "../src/services/deploymentLogger.ts";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const visualizationId = url.searchParams.get('id');

  if (!visualizationId) {
    return new Response('Missing visualization ID parameter', { status: 400 });
  }

  try {
    const deploymentLog = deploymentLogger.getLog(visualizationId);
    
    if (!deploymentLog) {
      return Response.json({
        error: 'Deployment log not found',
        visualizationId
      }, { status: 404 });
    }

    // Return the deployment status and recent events
    return Response.json({
      visualizationId: deploymentLog.visualizationId,
      status: deploymentLog.status,
      startTime: deploymentLog.startTime,
      endTime: deploymentLog.endTime,
      sandboxId: deploymentLog.sandboxId,
      sandboxUrl: deploymentLog.sandboxUrl,
      error: deploymentLog.error,
      events: deploymentLog.events.slice(-10), // Last 10 events
      stats: deploymentLogger.getStats()
    });

  } catch (error) {
    console.error(`Error getting deployment status for ${visualizationId}:`, error);
    return Response.json({
      error: 'Failed to get deployment status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}