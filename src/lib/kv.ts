/// <reference lib="deno.ns" />
/**
 * Deno KV Database Helpers
 *
 * This file provides typed functions for working with Deno KV.
 * Deno KV is a key-value database built into Deno that works
 * both locally and on Deno Deploy.
 *
 * Data Model:
 * - Users: ["users", workosUserId] -> User object
 * - Visualizations: ["visualizations", visId] -> Visualization object
 * - User's visualizations index: ["users_visualizations", userId, visId] -> visId
 * - Public share links: ["shares", publicId] -> visId
 */

// User data stored in KV
export interface User {
  id: string; // WorkOS user ID
  email: string;
  name: string;
  avatarUrl?: string;
  encryptedApiKey?: string; // AES-GCM encrypted Anthropic API key
  createdAt: Date;
  updatedAt: Date;
}

// Visualization data stored in KV
export interface Visualization {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  dataSourceUrl: string;
  html: string;
  publicId?: string; // Random ID for public sharing
  createdAt: Date;
  updatedAt: Date;
}

// Get a KV database connection
// This is cached automatically by Deno
let _kv: Deno.Kv | null = null;

export async function getKv(): Promise<Deno.Kv> {
  if (!_kv) {
    _kv = await Deno.openKv();
  }
  return _kv;
}

// ============================================================================
// User Functions
// ============================================================================

/**
 * Get a user by their WorkOS ID
 */
export async function getUser(userId: string): Promise<User | null> {
  const kv = await getKv();
  const result = await kv.get<User>(["users", userId]);
  return result.value;
}

/**
 * Create a new user
 */
export async function createUser(user: User): Promise<void> {
  const kv = await getKv();
  await kv.set(["users", user.id], user);
}

/**
 * Update an existing user
 */
export async function updateUser(user: User): Promise<void> {
  const kv = await getKv();
  await kv.set(["users", user.id], user);
}

/**
 * Delete a user and all their data
 */
export async function deleteUser(userId: string): Promise<void> {
  const kv = await getKv();

  // Delete all user's visualizations first
  const visualizations = await listVisualizationsByUser(userId);
  for (const viz of visualizations) {
    await deleteVisualization(viz.id, userId);
  }

  // Delete the user
  await kv.delete(["users", userId]);
}

// ============================================================================
// Visualization Functions
// ============================================================================

/**
 * Create a new visualization
 */
export async function createVisualization(viz: Visualization): Promise<void> {
  const kv = await getKv();

  // Use an atomic operation to set both the visualization and the index
  await kv
    .atomic()
    .set(["visualizations", viz.id], viz)
    .set(["users_visualizations", viz.userId, viz.id], viz.id)
    .commit();
}

/**
 * Get a visualization by ID
 */
export async function getVisualization(vizId: string): Promise<Visualization | null> {
  const kv = await getKv();
  const result = await kv.get<Visualization>(["visualizations", vizId]);
  return result.value;
}

/**
 * Update a visualization
 */
export async function updateVisualization(viz: Visualization): Promise<void> {
  const kv = await getKv();
  await kv.set(["visualizations", viz.id], viz);
}

/**
 * Delete a visualization
 */
export async function deleteVisualization(vizId: string, userId: string): Promise<void> {
  const kv = await getKv();

  // Get the visualization to check for public share
  const viz = await getVisualization(vizId);

  // Use atomic operation to delete visualization, index, and share link
  const atomic = kv.atomic()
    .delete(["visualizations", vizId])
    .delete(["users_visualizations", userId, vizId]);

  // If there's a public share, delete that too
  if (viz?.publicId) {
    atomic.delete(["shares", viz.publicId]);
  }

  await atomic.commit();
}

/**
 * List all visualizations for a user
 * Returns them sorted by creation date (newest first)
 */
export async function listVisualizationsByUser(userId: string): Promise<Visualization[]> {
  const kv = await getKv();
  const visualizations: Visualization[] = [];

  // List all visualization IDs for this user
  const iter = kv.list<string>({ prefix: ["users_visualizations", userId] });

  for await (const entry of iter) {
    const vizId = entry.value;
    const viz = await getVisualization(vizId);
    if (viz) {
      visualizations.push(viz);
    }
  }

  // Sort by creation date, newest first
  visualizations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return visualizations;
}

// ============================================================================
// Sharing Functions
// ============================================================================

/**
 * Generate a random public ID for sharing
 */
export function generatePublicId(): string {
  // Generate a URL-safe random string (12 characters)
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Create a public share link for a visualization
 */
export async function createShareLink(vizId: string, userId: string): Promise<string> {
  const kv = await getKv();

  // Get the visualization
  const viz = await getVisualization(vizId);
  if (!viz) {
    throw new Error("Visualization not found");
  }

  // Check ownership
  if (viz.userId !== userId) {
    throw new Error("Not authorized to share this visualization");
  }

  // If already shared, return existing public ID
  if (viz.publicId) {
    return viz.publicId;
  }

  // Generate new public ID
  const publicId = generatePublicId();

  // Update visualization with public ID and create share index
  const updatedViz: Visualization = {
    ...viz,
    publicId,
    updatedAt: new Date(),
  };

  await kv
    .atomic()
    .set(["visualizations", vizId], updatedViz)
    .set(["shares", publicId], vizId)
    .commit();

  return publicId;
}

/**
 * Remove public share link from a visualization
 */
export async function removeShareLink(vizId: string, userId: string): Promise<void> {
  const kv = await getKv();

  // Get the visualization
  const viz = await getVisualization(vizId);
  if (!viz) {
    throw new Error("Visualization not found");
  }

  // Check ownership
  if (viz.userId !== userId) {
    throw new Error("Not authorized to unshare this visualization");
  }

  // If not shared, nothing to do
  if (!viz.publicId) {
    return;
  }

  const publicId = viz.publicId;

  // Remove public ID and delete share index
  const updatedViz: Visualization = {
    ...viz,
    publicId: undefined,
    updatedAt: new Date(),
  };

  await kv
    .atomic()
    .set(["visualizations", vizId], updatedViz)
    .delete(["shares", publicId])
    .commit();
}

/**
 * Get a visualization by its public share ID
 * This is used for public viewing without authentication
 */
export async function getVisualizationByPublicId(
  publicId: string,
): Promise<Visualization | null> {
  const kv = await getKv();

  // Look up the visualization ID from the share index
  const result = await kv.get<string>(["shares", publicId]);
  if (!result.value) {
    return null;
  }

  // Get the actual visualization
  return await getVisualization(result.value);
}
