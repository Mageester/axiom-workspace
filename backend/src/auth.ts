import type { Env, AuthContext } from "./types";

/**
 * Hash a raw bearer token with SHA-256 and return hex string.
 * Uses Web Crypto API available in Workers runtime.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Device auth middleware.
 *
 * - Reads Authorization header (Bearer <token>)
 * - Hashes token with SHA-256
 * - Looks up device by token_hash in D1
 * - Rejects if device not found or revoked
 * - Updates last_seen_at on the device
 * - Returns AuthContext with user_id and device_id
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<AuthContext | Response> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return jsonError("Missing Authorization header", 401);
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return jsonError("Invalid Authorization header format. Expected: Bearer <token>", 401);
  }

  const token = parts[1];
  if (!token || token.trim().length === 0) {
    return jsonError("Empty bearer token", 401);
  }

  const tokenHash = await hashToken(token);

  const device = await env.AXIOM_DB.prepare(
    "SELECT id, user_id, revoked_at FROM devices WHERE token_hash = ?"
  )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; revoked_at: string | null }>();

  if (!device) {
    return jsonError("Unknown device token", 401);
  }

  if (device.revoked_at !== null) {
    return jsonError("Device token has been revoked", 403);
  }

  // Update last_seen_at
  await env.AXIOM_DB.prepare(
    "UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?"
  )
    .bind(device.id)
    .run();

  return {
    user_id: device.user_id,
    device_id: device.id,
  };
}

/** Create a JSON error response */
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
