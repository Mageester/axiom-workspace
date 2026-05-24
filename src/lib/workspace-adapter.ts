import type { HandoffNote, RegisteredProject, WorkspaceState } from "../types/workspace";

export interface WorkspaceAdapter {
  getProjects(): Promise<RegisteredProject[]>;
  addProject(project: Omit<RegisteredProject, "id" | "createdAt" | "updatedAt">): Promise<RegisteredProject>;
  updateProject(id: string, updates: Partial<RegisteredProject>): Promise<RegisteredProject>;
  removeProject(id: string): Promise<void>;
  getHandoffs(projectId?: string): Promise<HandoffNote[]>;
  addHandoff(note: Omit<HandoffNote, "id" | "createdAt">): Promise<HandoffNote>;
  getState(): Promise<WorkspaceState>;
  isOnline(): boolean;
}

const PROJECTS_KEY = "axiom-workspace:projects";
const HANDOFFS_KEY = "axiom-workspace:handoffs";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

interface CloudProject {
  id: string;
  name: string;
  slug: string;
  repo_url: string | null;
  default_branch: string | null;
  local_path_hint: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface CloudHandoff {
  id: string;
  project_id: string | null;
  session_id: string | null;
  author_user_id?: string | null;
  authorUserName?: string | null;
  summary: string | null;
  details: string | null;
  created_at: string;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function slugifyProjectName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

function loadArray<T>(key: string): T[] {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage may be unavailable; the app keeps in-memory state.
  }
}

function toCloudProject(input: Partial<RegisteredProject>): Record<string, unknown> {
  return {
    name: input.name,
    slug: input.slug,
    repo_url: input.repoUrl,
    default_branch: input.defaultBranch,
    local_path_hint: input.localPath,
    is_active: input.isActive === false ? 0 : 1,
  };
}

function fromCloudProject(project: CloudProject): RegisteredProject {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    repoUrl: project.repo_url ?? "",
    defaultBranch: project.default_branch ?? "main",
    localPath: project.local_path_hint ?? undefined,
    installStatus: project.local_path_hint ? "installed" : "unknown",
    isActive: project.is_active !== 0,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

function toCloudHandoff(input: Omit<HandoffNote, "id" | "createdAt">): Record<string, unknown> {
  return {
    project_id: input.projectId,
    session_id: input.sessionId,
    summary: input.summary,
    details: input.details,
  };
}

function fromCloudHandoff(note: CloudHandoff): HandoffNote {
  return {
    id: note.id,
    projectId: note.project_id ?? undefined,
    sessionId: note.session_id ?? undefined,
    authorUserName: note.authorUserName ?? note.author_user_id ?? "Axiom",
    summary: note.summary ?? undefined,
    details: note.details ?? undefined,
    createdAt: note.created_at,
  };
}

export class LocalWorkspaceAdapter implements WorkspaceAdapter {
  async getProjects(): Promise<RegisteredProject[]> {
    return loadArray<RegisteredProject>(PROJECTS_KEY);
  }

  async addProject(input: Omit<RegisteredProject, "id" | "createdAt" | "updatedAt">): Promise<RegisteredProject> {
    const projects = loadArray<RegisteredProject>(PROJECTS_KEY);
    const now = new Date().toISOString();
    const slug = input.slug || slugifyProjectName(input.name);
    const project: RegisteredProject = {
      ...input,
      id: createId(),
      slug,
      createdAt: now,
      updatedAt: now,
    };
    projects.push(project);
    saveArray(PROJECTS_KEY, projects);
    return project;
  }

  async updateProject(id: string, updates: Partial<RegisteredProject>): Promise<RegisteredProject> {
    const projects = loadArray<RegisteredProject>(PROJECTS_KEY);
    const index = projects.findIndex((project) => project.id === id);
    if (index === -1) throw new Error("Project not found");
    const updated = { ...projects[index], ...updates, updatedAt: new Date().toISOString() };
    projects[index] = updated;
    saveArray(PROJECTS_KEY, projects);
    return updated;
  }

  async removeProject(id: string): Promise<void> {
    saveArray(PROJECTS_KEY, loadArray<RegisteredProject>(PROJECTS_KEY).filter((project) => project.id !== id));
  }

  async getHandoffs(projectId?: string): Promise<HandoffNote[]> {
    const notes = loadArray<HandoffNote>(HANDOFFS_KEY);
    return projectId ? notes.filter((note) => note.projectId === projectId) : notes;
  }

  async addHandoff(input: Omit<HandoffNote, "id" | "createdAt">): Promise<HandoffNote> {
    const notes = loadArray<HandoffNote>(HANDOFFS_KEY);
    const note: HandoffNote = { ...input, id: createId(), createdAt: new Date().toISOString() };
    notes.unshift(note);
    saveArray(HANDOFFS_KEY, notes);
    return note;
  }

  async getState(): Promise<WorkspaceState> {
    return { projects: await this.getProjects(), isOnline: false };
  }

  isOnline(): boolean {
    return false;
  }
}

export class CloudflareWorkspaceAdapter implements WorkspaceAdapter {
  private apiUrl: string;
  private token: string;

  constructor(apiUrl: string, token: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await globalThis.fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(options?.headers || {}),
      },
    });

    const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !envelope?.ok) {
      const message = envelope && "error" in envelope ? envelope.error : `API error ${response.status}`;
      throw new Error(message);
    }
    return envelope.data;
  }

  async getProjects(): Promise<RegisteredProject[]> {
    const projects = await this.request<CloudProject[]>("/projects");
    return projects.map(fromCloudProject);
  }

  async addProject(input: Omit<RegisteredProject, "id" | "createdAt" | "updatedAt">): Promise<RegisteredProject> {
    const project = await this.request<CloudProject>("/projects", {
      method: "POST",
      body: JSON.stringify(toCloudProject(input)),
    });
    return fromCloudProject(project);
  }

  async updateProject(id: string, updates: Partial<RegisteredProject>): Promise<RegisteredProject> {
    const project = await this.request<CloudProject>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(toCloudProject(updates)),
    });
    return fromCloudProject(project);
  }

  async removeProject(id: string): Promise<void> {
    await this.updateProject(id, { isActive: false });
  }

  async getHandoffs(projectId?: string): Promise<HandoffNote[]> {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    const notes = await this.request<CloudHandoff[]>(`/handoffs${query}`);
    return notes.map(fromCloudHandoff);
  }

  async addHandoff(input: Omit<HandoffNote, "id" | "createdAt">): Promise<HandoffNote> {
    const note = await this.request<CloudHandoff>("/handoffs", {
      method: "POST",
      body: JSON.stringify(toCloudHandoff(input)),
    });
    return fromCloudHandoff(note);
  }

  async getState(): Promise<WorkspaceState> {
    const data = await this.request<{ projects: CloudProject[]; synced_at?: string }>("/workspace/state");
    return {
      projects: data.projects.map(fromCloudProject),
      isOnline: true,
      lastSyncAt: data.synced_at,
    };
  }

  isOnline(): boolean {
    return true;
  }
}
