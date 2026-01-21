/// <reference lib="deno.ns" />
/**
 * Authentication Middleware & Session Management
 *
 * This file handles:
 * - Session cookie validation
 * - User authentication state
 * - Protected route middleware
 *
 * Sessions use encrypted cookies with AES-256-GCM to store user data
 * securely without requiring a session database.
 */

import { workos, workosClientId } from "./workos.ts";
import { createUser, getUser, updateUser, type User } from "./kv.ts";

// Session cookie name
const SESSION_COOKIE_NAME = "viz_whisperer_session";

// Maximum session age: 7 days
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

/**
 * Session data stored in the encrypted cookie
 * This is what we seal/unseal with iron-webcrypto
 */
export interface SessionData {
  userId: string; // WorkOS user ID
  email: string;
  name: string;
  avatarUrl?: string;
  expiresAt: number; // Unix timestamp
}

/**
 * Get the encryption key for session cookies
 * Uses WORKOS_COOKIE_PASSWORD as the key material
 * Must be a 32-byte base64-encoded secret
 */
async function getSessionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("WORKOS_COOKIE_PASSWORD");
  if (!secret) {
    console.error(
      "WORKOS_COOKIE_PASSWORD must be set. " +
        "Generate one with: openssl rand -base64 32",
    );
    throw new Error("Session encryption not configured");
  }

  // Decode base64 to bytes
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));

  if (keyBytes.length !== 32) {
    console.error(
      `WORKOS_COOKIE_PASSWORD must be 32 bytes (got ${keyBytes.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
    throw new Error("Session encryption key must be 32 bytes");
  }

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Seal (encrypt) session data for storage in a cookie
 * Uses AES-256-GCM encryption
 * Output format: base64(iv):base64(ciphertext+authTag)
 */
async function sealSession(data: SessionData): Promise<string> {
  const key = await getSessionKey();

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode session data as JSON bytes
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  // Encrypt with AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  // Encode as base64 for cookie storage
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const ciphertextBase64 = btoa(
    String.fromCharCode(...new Uint8Array(ciphertext)),
  );

  return `${ivBase64}:${ciphertextBase64}`;
}

/**
 * Unseal (decrypt) session data from a cookie
 * Returns null if decryption fails
 */
async function unsealSession(sealed: string): Promise<SessionData | null> {
  try {
    const key = await getSessionKey();

    // Parse the sealed format
    const parts = sealed.split(":");
    if (parts.length !== 2) {
      return null;
    }

    const [ivBase64, ciphertextBase64] = parts;

    // Decode from base64
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(
      atob(ciphertextBase64),
      (c) => c.charCodeAt(0),
    );

    // Decrypt with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    // Parse JSON session data
    const decoder = new TextDecoder();
    const json = decoder.decode(decrypted);
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Parse session cookie from request headers
 * Returns null if no valid session exists
 */
export async function getSession(req: Request): Promise<SessionData | null> {
  try {
    const cookieHeader = req.headers.get("Cookie");
    if (!cookieHeader) {
      return null;
    }

    // Parse cookies manually (simple implementation)
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [key, ...rest] = c.trim().split("=");
        return [key, rest.join("=")];
      }),
    );

    const sessionCookie = cookies[SESSION_COOKIE_NAME];
    if (!sessionCookie) {
      return null;
    }

    // Decrypt the session data
    const sessionData = await unsealSession(sessionCookie);
    if (!sessionData) {
      return null;
    }

    // Check if session has expired
    if (sessionData.expiresAt < Date.now()) {
      return null;
    }

    return sessionData;
  } catch (error) {
    // Session is invalid or expired
    console.error("Failed to parse session:", error);
    return null;
  }
}

/**
 * Create a session cookie value for the given user
 */
export async function createSessionCookie(
  userId: string,
  email: string,
  name: string,
  avatarUrl?: string,
): Promise<string> {
  const sessionData: SessionData = {
    userId,
    email,
    name,
    avatarUrl,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };

  const sealed = await sealSession(sessionData);

  // Build the Set-Cookie header value
  const secure = Deno.env.get("DENO_DEPLOYMENT_ID") ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${sealed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

/**
 * Create a cookie that clears the session (for logout)
 */
export function createLogoutCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Get the current authenticated user from the session
 * Returns the full User object from KV, or null if not authenticated
 */
export async function getCurrentUser(req: Request): Promise<User | null> {
  const session = await getSession(req);
  if (!session) {
    return null;
  }

  // Fetch user from KV
  const user = await getUser(session.userId);
  return user;
}

/**
 * Require authentication for an API endpoint
 * Returns the user if authenticated, or a 401 Response if not
 */
export async function requireAuth(
  req: Request,
): Promise<User | Response> {
  const user = await getCurrentUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Generate the WorkOS authorization URL for OAuth login
 * This redirects users to GitHub (or other configured provider) to sign in
 */
export function getAuthorizationUrl(redirectUri: string, state?: string): string {
  const authUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: workosClientId,
    redirectUri,
    state,
  });
  return authUrl;
}

/**
 * Exchange an authorization code for user information
 * Called after the user returns from the OAuth provider
 */
export async function authenticateWithCode(code: string): Promise<{
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}> {
  const { user } = await workos.userManagement.authenticateWithCode({
    clientId: workosClientId,
    code,
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.firstName
      ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
      : user.email.split("@")[0],
    avatarUrl: user.profilePictureUrl || undefined,
  };
}

/**
 * Create or update a user in KV after successful authentication
 */
export async function ensureUserInKv(
  userId: string,
  email: string,
  name: string,
  avatarUrl?: string,
): Promise<User> {
  // Check if user exists
  const existingUser = await getUser(userId);

  if (existingUser) {
    // Update user info in case it changed
    const updatedUser: User = {
      ...existingUser,
      email,
      name,
      avatarUrl,
      updatedAt: new Date(),
    };
    await updateUser(updatedUser);
    return updatedUser;
  }

  // Create new user
  const newUser: User = {
    id: userId,
    email,
    name,
    avatarUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await createUser(newUser);
  return newUser;
}
