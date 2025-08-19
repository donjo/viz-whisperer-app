/// <reference lib="deno.ns" />
import { sandboxService } from "../src/services/sandboxService.ts";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const isConfigured = sandboxService.isConfigured();
    const stats = sandboxService.getStats();
    const deployToken = Deno.env.get("DEPLOY_TOKEN");
    
    const status = {
      sandboxEnabled: isConfigured,
      deployTokenConfigured: !!deployToken,
      activeSandboxes: stats.active,
      oldestSandbox: stats.oldest?.toISOString() || null,
      message: isConfigured 
        ? "Sandbox functionality is enabled" 
        : "Sandbox functionality disabled - DEPLOY_TOKEN not configured"
    };

    return Response.json(status);

  } catch (error) {
    console.error('Error checking sandbox status:', error);
    return Response.json({
      error: 'Failed to check sandbox status',
      sandboxEnabled: false
    }, { status: 500 });
  }
}