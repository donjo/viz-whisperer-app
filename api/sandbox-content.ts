/// <reference lib="deno.ns" />
import { sandboxService } from "../src/services/sandboxService.ts";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const sandboxId = url.searchParams.get('id');

  if (!sandboxId) {
    return new Response('Missing sandbox ID parameter', { status: 400 });
  }

  try {
    const response = await sandboxService.fetchFromSandbox(sandboxId);
    const html = await response.text();
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error(`Error fetching sandbox content for ${sandboxId}:`, error);
    return Response.json({
      error: 'Failed to fetch sandbox content',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}