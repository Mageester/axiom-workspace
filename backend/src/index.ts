import { authenticate } from "./auth";
import type {
  Env,
  AuthContext,
  ApiResponse,
  User,
  Project,
  Session,
  ActivityEvent,
  HandoffNote,
  RepoSnapshot,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────

function json<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ ok: true, data } satisfies ApiResponse<T>),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function jsonError(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message } satisfies ApiResponse),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function generateId(): string {
  return crypto.randomUUID();
}

async function readBody<T = Record<string, unknown>>(
  request: Request
): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Simple path matcher. Returns params or null. */
function matchRoute(
  method: string,
  pattern: string,
  reqMethod: string,
  pathname: string
): Record<string, string> | null {
  if (method !== reqMethod) return null;

  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

// ─── Route Handlers ───────────────────────────────────────

async function handleHealth(env: Env): Promise<Response> {
  return json({ status: "ok", version: env.API_VERSION || "1.5.0" });
}

async function handleGetMe(
  env: Env,
  auth: AuthContext
): Promise<Response> {
  const user = await env.AXIOM_DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  )
    .bind(auth.user_id)
    .first<User>();

  if (!user) {
    return jsonError("User not found", 404);
  }

  return json({ user, device_id: auth.device_id });
}

async function handleGetWorkspaceState(
  env: Env,
  auth: AuthContext
): Promise<Response> {
  const [users, projects, activeSessions, recentActivity, activeLocks] =
    await Promise.all([
      env.AXIOM_DB.prepare("SELECT * FROM users").all<User>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM projects WHERE is_active = 1"
      ).all<Project>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM sessions WHERE status = 'active'"
      ).all<Session>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 50"
      ).all<ActivityEvent>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM locks WHERE status = 'active'"
      ).all(),
    ]);

  return json({
    users: users.results,
    projects: projects.results,
    active_sessions: activeSessions.results,
    recent_activity: recentActivity.results,
    active_locks: activeLocks.results,
  });
}

async function handleListProjects(env: Env): Promise<Response> {
  const result = await env.AXIOM_DB.prepare(
    "SELECT * FROM projects WHERE is_active = 1 ORDER BY name"
  ).all<Project>();

  return json(result.results);
}

async function handleCreateProject(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await readBody<{
    name?: string;
    slug?: string;
    repo_url?: string;
    default_branch?: string;
    local_path_hint?: string;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");
  if (!body.name || typeof body.name !== "string")
    return jsonError("name is required");
  if (!body.slug || typeof body.slug !== "string")
    return jsonError("slug is required");

  const id = generateId();

  await env.AXIOM_DB.prepare(
    `INSERT INTO projects (id, name, slug, repo_url, default_branch, local_path_hint)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.name,
      body.slug,
      body.repo_url ?? null,
      body.default_branch ?? "main",
      body.local_path_hint ?? null
    )
    .run();

  const project = await env.AXIOM_DB.prepare(
    "SELECT * FROM projects WHERE id = ?"
  )
    .bind(id)
    .first<Project>();

  return json(project, 201);
}

async function handleUpdateProject(
  request: Request,
  env: Env,
  params: Record<string, string>
): Promise<Response> {
  const body = await readBody<{
    name?: string;
    slug?: string;
    repo_url?: string;
    default_branch?: string;
    local_path_hint?: string;
    status?: string;
    is_active?: number;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");

  const existing = await env.AXIOM_DB.prepare(
    "SELECT id FROM projects WHERE id = ?"
  )
    .bind(params.id)
    .first();

  if (!existing) return jsonError("Project not found", 404);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    fields.push("name = ?");
    values.push(body.name);
  }
  if (body.slug !== undefined) {
    fields.push("slug = ?");
    values.push(body.slug);
  }
  if (body.repo_url !== undefined) {
    fields.push("repo_url = ?");
    values.push(body.repo_url);
  }
  if (body.default_branch !== undefined) {
    fields.push("default_branch = ?");
    values.push(body.default_branch);
  }
  if (body.local_path_hint !== undefined) {
    fields.push("local_path_hint = ?");
    values.push(body.local_path_hint);
  }
  if (body.status !== undefined) {
    fields.push("status = ?");
    values.push(body.status);
  }
  if (body.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(body.is_active);
  }

  if (fields.length === 0) return jsonError("No fields to update");

  fields.push("updated_at = datetime('now')");
  values.push(params.id);

  await env.AXIOM_DB.prepare(
    `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`
  )
    .bind(...values)
    .run();

  const project = await env.AXIOM_DB.prepare(
    "SELECT * FROM projects WHERE id = ?"
  )
    .bind(params.id)
    .first<Project>();

  return json(project);
}

async function handleSaveSnapshot(
  request: Request,
  env: Env,
  auth: AuthContext,
  params: Record<string, string>
): Promise<Response> {
  const body = await readBody<{
    branch?: string;
    clean_state?: number;
    changed_file_count?: number;
    ahead_count?: number;
    behind_count?: number;
    has_conflicts?: number;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");

  const existing = await env.AXIOM_DB.prepare(
    "SELECT id FROM projects WHERE id = ?"
  )
    .bind(params.id)
    .first();

  if (!existing) return jsonError("Project not found", 404);

  const id = generateId();

  await env.AXIOM_DB.prepare(
    `INSERT INTO repo_snapshots
       (id, project_id, device_id, branch, clean_state, changed_file_count,
        ahead_count, behind_count, has_conflicts, last_checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      id,
      params.id,
      auth.device_id,
      body.branch ?? null,
      body.clean_state ?? 1,
      body.changed_file_count ?? 0,
      body.ahead_count ?? 0,
      body.behind_count ?? 0,
      body.has_conflicts ?? 0
    )
    .run();

  const snapshot = await env.AXIOM_DB.prepare(
    "SELECT * FROM repo_snapshots WHERE id = ?"
  )
    .bind(id)
    .first<RepoSnapshot>();

  return json(snapshot, 201);
}

async function handleStartSession(
  request: Request,
  env: Env,
  auth: AuthContext
): Promise<Response> {
  const body = await readBody<{
    project_id?: string;
    branch?: string;
    note?: string;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");

  // Check for existing active session for this user
  const activeSession = await env.AXIOM_DB.prepare(
    "SELECT id FROM sessions WHERE user_id = ? AND status = 'active'"
  )
    .bind(auth.user_id)
    .first();

  if (activeSession) {
    return jsonError(
      "User already has an active session. Finish it before starting a new one.",
      409
    );
  }

  const id = generateId();

  await env.AXIOM_DB.prepare(
    `INSERT INTO sessions (id, user_id, device_id, project_id, branch, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      auth.user_id,
      auth.device_id,
      body.project_id ?? null,
      body.branch ?? null,
      body.note ?? null
    )
    .run();

  // Create activity event for session start
  await env.AXIOM_DB.prepare(
    `INSERT INTO activity_events (id, type, actor_user_id, project_id, session_id, title)
     VALUES (?, 'session_start', ?, ?, ?, 'Started work session')`
  )
    .bind(generateId(), auth.user_id, body.project_id ?? null, id)
    .run();

  const session = await env.AXIOM_DB.prepare(
    "SELECT * FROM sessions WHERE id = ?"
  )
    .bind(id)
    .first<Session>();

  return json(session, 201);
}

async function handleFinishSession(
  request: Request,
  env: Env,
  auth: AuthContext,
  params: Record<string, string>
): Promise<Response> {
  const session = await env.AXIOM_DB.prepare(
    "SELECT * FROM sessions WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, auth.user_id)
    .first<Session>();

  if (!session) return jsonError("Session not found", 404);
  if (session.status !== "active")
    return jsonError("Session is not active", 409);

  const body = await readBody<{ note?: string }>(request);

  // Calculate duration from started_at to now
  await env.AXIOM_DB.prepare(
    `UPDATE sessions SET
       status = 'finished',
       ended_at = datetime('now'),
       duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER),
       note = COALESCE(?, note)
     WHERE id = ?`
  )
    .bind(body?.note ?? null, params.id)
    .run();

  // Create activity event for session end
  await env.AXIOM_DB.prepare(
    `INSERT INTO activity_events (id, type, actor_user_id, project_id, session_id, title)
     VALUES (?, 'session_end', ?, ?, ?, 'Finished work session')`
  )
    .bind(
      generateId(),
      auth.user_id,
      session.project_id,
      params.id
    )
    .run();

  const updated = await env.AXIOM_DB.prepare(
    "SELECT * FROM sessions WHERE id = ?"
  )
    .bind(params.id)
    .first<Session>();

  return json(updated);
}

async function handleListActivity(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );
  const projectId = url.searchParams.get("project_id");

  let query: string;
  const bindings: unknown[] = [];

  if (projectId) {
    query =
      "SELECT * FROM activity_events WHERE project_id = ? ORDER BY created_at DESC LIMIT ?";
    bindings.push(projectId, limit);
  } else {
    query =
      "SELECT * FROM activity_events ORDER BY created_at DESC LIMIT ?";
    bindings.push(limit);
  }

  const result = await env.AXIOM_DB.prepare(query)
    .bind(...bindings)
    .all<ActivityEvent>();

  return json(result.results);
}

async function handleCreateHandoff(
  request: Request,
  env: Env,
  auth: AuthContext
): Promise<Response> {
  const body = await readBody<{
    project_id?: string;
    session_id?: string;
    summary?: string;
    details?: string;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");
  if (!body.summary && !body.details)
    return jsonError("Either summary or details is required");

  const id = generateId();

  await env.AXIOM_DB.prepare(
    `INSERT INTO handoff_notes (id, project_id, session_id, author_user_id, summary, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.project_id ?? null,
      body.session_id ?? null,
      auth.user_id,
      body.summary ?? null,
      body.details ?? null
    )
    .run();

  // Create activity event for handoff
  await env.AXIOM_DB.prepare(
    `INSERT INTO activity_events (id, type, actor_user_id, project_id, title, body)
     VALUES (?, 'handoff', ?, ?, 'Created handoff note', ?)`
  )
    .bind(
      generateId(),
      auth.user_id,
      body.project_id ?? null,
      body.summary ?? null
    )
    .run();

  const note = await env.AXIOM_DB.prepare(
    "SELECT * FROM handoff_notes WHERE id = ?"
  )
    .bind(id)
    .first<HandoffNote>();

  return json(note, 201);
}

async function handleListHandoffs(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");

  const result = projectId
    ? await env.AXIOM_DB.prepare(
        "SELECT * FROM handoff_notes WHERE project_id = ? ORDER BY created_at DESC LIMIT 100"
      )
        .bind(projectId)
        .all<HandoffNote>()
    : await env.AXIOM_DB.prepare(
        "SELECT * FROM handoff_notes ORDER BY created_at DESC LIMIT 100"
      ).all<HandoffNote>();

  return json(result.results);
}

async function handleRegisterDevice(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await readBody<{
    user_id?: string;
    device_name?: string;
    token?: string;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");
  if (!body.user_id || typeof body.user_id !== "string")
    return jsonError("user_id is required");
  if (!body.device_name || typeof body.device_name !== "string")
    return jsonError("device_name is required");
  if (!body.token || typeof body.token !== "string")
    return jsonError("token is required");

  // Verify user exists
  const user = await env.AXIOM_DB.prepare(
    "SELECT id FROM users WHERE id = ?"
  )
    .bind(body.user_id)
    .first();

  if (!user) return jsonError("User not found", 404);

  // Hash the token
  const encoder = new TextEncoder();
  const data = encoder.encode(body.token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const tokenHash = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const id = generateId();

  await env.AXIOM_DB.prepare(
    `INSERT INTO devices (id, user_id, device_name, token_hash, last_seen_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(id, body.user_id, body.device_name, tokenHash)
    .run();

  // Return device info (not the token hash)
  return json(
    {
      id,
      user_id: body.user_id,
      device_name: body.device_name,
      created_at: new Date().toISOString(),
    },
    201
  );
}

async function handleSyncPush(
  request: Request,
  env: Env,
  auth: AuthContext
): Promise<Response> {
  const body = await readBody<{
    events?: Array<{
      type: string;
      project_id?: string;
      title: string;
      body?: string;
      importance?: string;
    }>;
    snapshots?: Array<{
      project_id: string;
      branch?: string;
      clean_state?: number;
      changed_file_count?: number;
      ahead_count?: number;
      behind_count?: number;
      has_conflicts?: number;
    }>;
    settings?: Array<{
      scope?: string;
      key: string;
      value?: string;
    }>;
  }>(request);

  if (!body) return jsonError("Invalid JSON body");

  const results = { events_created: 0, snapshots_created: 0, settings_updated: 0 };

  // Process events
  if (body.events && Array.isArray(body.events)) {
    for (const event of body.events) {
      if (!event.type || !event.title) continue;
      await env.AXIOM_DB.prepare(
        `INSERT INTO activity_events (id, type, actor_user_id, project_id, title, body, importance)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          generateId(),
          event.type,
          auth.user_id,
          event.project_id ?? null,
          event.title,
          event.body ?? null,
          event.importance ?? "normal"
        )
        .run();
      results.events_created++;
    }
  }

  // Process snapshots
  if (body.snapshots && Array.isArray(body.snapshots)) {
    for (const snap of body.snapshots) {
      if (!snap.project_id) continue;
      await env.AXIOM_DB.prepare(
        `INSERT INTO repo_snapshots
           (id, project_id, device_id, branch, clean_state, changed_file_count,
            ahead_count, behind_count, has_conflicts, last_checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          generateId(),
          snap.project_id,
          auth.device_id,
          snap.branch ?? null,
          snap.clean_state ?? 1,
          snap.changed_file_count ?? 0,
          snap.ahead_count ?? 0,
          snap.behind_count ?? 0,
          snap.has_conflicts ?? 0
        )
        .run();
      results.snapshots_created++;
    }
  }

  // Process settings
  if (body.settings && Array.isArray(body.settings)) {
    for (const setting of body.settings) {
      if (!setting.key) continue;
      const id = generateId();
      await env.AXIOM_DB.prepare(
        `INSERT INTO settings (id, scope, key, value, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
        .bind(
          id,
          setting.scope ?? "workspace",
          setting.key,
          setting.value ?? null
        )
        .run();
      results.settings_updated++;
    }
  }

  return json(results);
}

async function handleSyncPull(
  request: Request,
  env: Env,
  auth: AuthContext
): Promise<Response> {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  const sinceFilter = since ?? "1970-01-01T00:00:00Z";

  const [projects, sessions, events, handoffs, snapshots, settings] =
    await Promise.all([
      env.AXIOM_DB.prepare(
        "SELECT * FROM projects WHERE is_active = 1 AND updated_at > ?"
      )
        .bind(sinceFilter)
        .all<Project>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM sessions WHERE user_id = ? AND created_at > ?"
      )
        .bind(auth.user_id, sinceFilter)
        .all<Session>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM activity_events WHERE created_at > ? ORDER BY created_at DESC LIMIT 100"
      )
        .bind(sinceFilter)
        .all<ActivityEvent>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM handoff_notes WHERE created_at > ? ORDER BY created_at DESC LIMIT 50"
      )
        .bind(sinceFilter)
        .all<HandoffNote>(),
      env.AXIOM_DB.prepare(
        "SELECT * FROM repo_snapshots WHERE created_at > ? ORDER BY created_at DESC LIMIT 50"
      )
        .bind(sinceFilter)
        .all<RepoSnapshot>(),
      env.AXIOM_DB.prepare("SELECT * FROM settings").all(),
    ]);

  return json({
    projects: projects.results,
    sessions: sessions.results,
    events: events.results,
    handoffs: handoffs.results,
    snapshots: snapshots.results,
    settings: settings.results,
    synced_at: new Date().toISOString(),
  });
}

// ─── Main Worker ──────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // CORS headers for Tauri desktop app
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let response: Response;
      let params: Record<string, string> | null;

      // ── Public routes (no auth) ──

      if ((params = matchRoute("GET", "/health", method, pathname))) {
        response = await handleHealth(env);
        return addCors(response, corsHeaders);
      }

      if (
        (params = matchRoute(
          "POST",
          "/devices/register",
          method,
          pathname
        ))
      ) {
        response = await handleRegisterDevice(request, env);
        return addCors(response, corsHeaders);
      }

      // ── Authenticated routes ──

      const authResult = await authenticate(request, env);
      if (authResult instanceof Response) {
        return addCors(authResult, corsHeaders);
      }
      const auth: AuthContext = authResult;

      // GET routes
      if ((params = matchRoute("GET", "/me", method, pathname))) {
        response = await handleGetMe(env, auth);
      } else if (
        (params = matchRoute(
          "GET",
          "/workspace/state",
          method,
          pathname
        ))
      ) {
        response = await handleGetWorkspaceState(env, auth);
      } else if (
        (params = matchRoute("GET", "/projects", method, pathname))
      ) {
        response = await handleListProjects(env);
      } else if (
        (params = matchRoute("GET", "/activity", method, pathname))
      ) {
        response = await handleListActivity(request, env);
      } else if (
        (params = matchRoute("GET", "/handoffs", method, pathname))
      ) {
        response = await handleListHandoffs(request, env);
      } else if (
        (params = matchRoute("GET", "/sync/pull", method, pathname))
      ) {
        response = await handleSyncPull(request, env, auth);
      }
      // POST routes
      else if (
        (params = matchRoute("POST", "/projects", method, pathname))
      ) {
        response = await handleCreateProject(request, env);
      } else if (
        (params = matchRoute(
          "POST",
          "/projects/:id/snapshot",
          method,
          pathname
        ))
      ) {
        response = await handleSaveSnapshot(request, env, auth, params);
      } else if (
        (params = matchRoute(
          "POST",
          "/sessions/start",
          method,
          pathname
        ))
      ) {
        response = await handleStartSession(request, env, auth);
      } else if (
        (params = matchRoute(
          "POST",
          "/sessions/:id/finish",
          method,
          pathname
        ))
      ) {
        response = await handleFinishSession(request, env, auth, params);
      } else if (
        (params = matchRoute("POST", "/handoffs", method, pathname))
      ) {
        response = await handleCreateHandoff(request, env, auth);
      } else if (
        (params = matchRoute("POST", "/sync/push", method, pathname))
      ) {
        response = await handleSyncPush(request, env, auth);
      }
      // PATCH routes
      else if (
        (params = matchRoute(
          "PATCH",
          "/projects/:id",
          method,
          pathname
        ))
      ) {
        response = await handleUpdateProject(request, env, params);
      }
      // 404
      else {
        response = jsonError("Not found", 404);
      }

      return addCors(response, corsHeaders);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      console.error("Worker error:", err);
      return addCors(jsonError(message, 500), corsHeaders);
    }
  },
} satisfies ExportedHandler<Env>;

function addCors(
  response: Response,
  corsHeaders: Record<string, string>
): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
