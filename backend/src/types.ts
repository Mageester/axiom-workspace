/** Axiom Workspace D1 Table Types */

export interface User {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  token_hash: string;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  repo_url: string | null;
  default_branch: string;
  local_path_hint: string | null;
  status: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  device_id: string | null;
  project_id: string | null;
  branch: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  created_at: string;
}

export interface Lock {
  id: string;
  project_id: string;
  user_id: string;
  lock_scope: string;
  reason: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  cleared_at: string | null;
}

export interface ActivityEvent {
  id: string;
  type: string;
  actor_user_id: string | null;
  project_id: string | null;
  session_id: string | null;
  title: string;
  body: string | null;
  importance: string;
  created_at: string;
}

export interface HandoffNote {
  id: string;
  project_id: string | null;
  session_id: string | null;
  author_user_id: string;
  summary: string | null;
  details: string | null;
  created_at: string;
}

export interface RepoSnapshot {
  id: string;
  project_id: string;
  device_id: string | null;
  branch: string | null;
  clean_state: number;
  changed_file_count: number;
  ahead_count: number;
  behind_count: number;
  has_conflicts: number;
  last_checked_at: string | null;
  created_at: string;
}

export interface Setting {
  id: string;
  scope: string;
  key: string;
  value: string | null;
  updated_at: string;
}

/** Worker environment bindings */
export interface Env {
  AXIOM_DB: D1Database;
  API_VERSION: string;
  ENVIRONMENT: string;
}

/** Auth context attached after middleware */
export interface AuthContext {
  user_id: string;
  device_id: string;
}

/** Standard JSON response envelope */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
