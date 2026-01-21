/// <reference lib="deno.ns" />
/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption for storing sensitive data like API keys.
 * Uses the Web Crypto API which is available in both Deno and browsers.
 *
 * Storage format: base64(iv):base64(ciphertext):base64(authTag)
 * - iv: 12 bytes (96 bits) - initialization vector, random per encryption
 * - ciphertext: encrypted data
 * - authTag: 16 bytes (128 bits) - authentication tag for integrity
 */

/**
 * Get the encryption key from environment
 * Must be a 32-byte (256-bit) key encoded as base64
 */
function getEncryptionSecret(): Uint8Array {
  const secret = Deno.env.get("ENCRYPTION_SECRET");
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET is required. Generate one with: openssl rand -base64 32",
    );
  }

  // Decode base64 to bytes
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));

  if (keyBytes.length !== 32) {
    throw new Error(
      `ENCRYPTION_SECRET must be 32 bytes (got ${keyBytes.length}). Generate with: openssl rand -base64 32`,
    );
  }

  return keyBytes;
}

/**
 * Import the encryption key for use with Web Crypto API
 */
async function getKey(): Promise<CryptoKey> {
  const keyBytes = getEncryptionSecret();

  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false, // not extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a string value using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: base64(iv):base64(ciphertext+authTag)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();

  // Generate a random 12-byte IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Encrypt with AES-GCM (includes authentication tag)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  // Convert to base64 for storage
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivBase64}:${ciphertextBase64}`;
}

/**
 * Decrypt a string that was encrypted with encrypt()
 *
 * @param encrypted - The encrypted string in format: base64(iv):base64(ciphertext+authTag)
 * @returns The original plaintext string
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await getKey();

  // Parse the encrypted format
  const parts = encrypted.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted format");
  }

  const [ivBase64, ciphertextBase64] = parts;

  // Decode from base64
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));

  // Decrypt with AES-GCM
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  // Decode bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Check if the encryption secret is properly configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionSecret();
    return true;
  } catch {
    return false;
  }
}
