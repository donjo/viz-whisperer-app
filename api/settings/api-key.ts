/// <reference lib="deno.ns" />
/**
 * API Key Management Endpoint
 *
 * PUT /api/settings/api-key - Save or update encrypted API key
 * DELETE /api/settings/api-key - Remove saved API key
 * GET /api/settings/api-key - Check if API key exists (does not return the key)
 */

import { requireAuth } from "../../src/lib/auth.ts";
import { getUser, updateUser, type User } from "../../src/lib/kv.ts";
import { encrypt, isEncryptionConfigured } from "../../src/lib/encryption.ts";

export default async function handler(req: Request): Promise<Response> {
  // All endpoints require authentication
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) {
    return authResult; // 401 Unauthorized
  }
  const user = authResult;

  switch (req.method) {
    case "GET":
      return handleGet(user);
    case "PUT":
      return handlePut(req, user);
    case "DELETE":
      return handleDelete(user);
    default:
      return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}

/**
 * GET - Check if user has an API key saved
 */
function handleGet(user: User): Response {
  return Response.json({
    hasApiKey: !!user.encryptedApiKey,
  });
}

/**
 * PUT - Save or update encrypted API key
 */
async function handlePut(req: Request, user: User): Promise<Response> {
  // Check encryption is configured
  if (!isEncryptionConfigured()) {
    return Response.json(
      { error: "Encryption is not configured on this server" },
      { status: 503 },
    );
  }

  // Parse request body
  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { apiKey } = body;

  // Validate API key
  if (!apiKey || typeof apiKey !== "string") {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return Response.json({ error: "API key cannot be empty" }, { status: 400 });
  }

  // Basic format validation for Anthropic keys
  if (!trimmedKey.startsWith("sk-ant-")) {
    return Response.json(
      { error: "Invalid API key format. Anthropic keys should start with 'sk-ant-'" },
      { status: 400 },
    );
  }

  try {
    // Encrypt the API key
    const encryptedKey = await encrypt(trimmedKey);

    // Update user record
    const updatedUser: User = {
      ...user,
      encryptedApiKey: encryptedKey,
      updatedAt: new Date(),
    };

    await updateUser(updatedUser);

    return Response.json({
      success: true,
      message: "API key saved successfully",
    });
  } catch (error) {
    console.error("Failed to save API key:", error);
    return Response.json(
      { error: "Failed to save API key" },
      { status: 500 },
    );
  }
}

/**
 * DELETE - Remove saved API key
 */
async function handleDelete(user: User): Promise<Response> {
  try {
    // Remove encrypted key from user record
    const updatedUser: User = {
      ...user,
      encryptedApiKey: undefined,
      updatedAt: new Date(),
    };

    await updateUser(updatedUser);

    return Response.json({
      success: true,
      message: "API key removed successfully",
    });
  } catch (error) {
    console.error("Failed to remove API key:", error);
    return Response.json(
      { error: "Failed to remove API key" },
      { status: 500 },
    );
  }
}
