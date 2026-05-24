import type { RegisteredProject, HandoffNote, WorkspaceState } from "../types/workspace";

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

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function loadProjects(): RegisteredProject[] {
  try {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: RegisteredProject[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {}
}

function loadHandoffs(): HandoffNote[] {
  try {
    const stored = localStorage.getItem(HANDOFFS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHandoffs(notes: HandoffNote[]): void {
  try {
    localStorage.setItem(HANDOFFS_KEY, JSON.stringify(notes));
  } catch {}
}

export class LocalWorkspaceAdapter implements WorkspaceAdapter {
  async getProjects(): Promise<RegisteredProject[]> {
    return loadProjects();
  }

  async addProject(input: Omit<RegisteredProject, "id" | "createdAt" | "updatedAt">): Promise<RegisteredProject> {
    const projects = loadProjects();
    const now = new Date().toISOString();
    const project: RegisteredProject = {
      ...input,
      id: createId(),
      slug: input.slug || slugify(input.name),
      createdAt: now,
      updatedAt: now,
    };
    projects.push(project);
    saveProjects(projects);
    return project;
  }

  async updateProject(id: string, updates: Partial<RegisteredProject>): Promise<RegisteredProject> {
    const projects = loadProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Project not found");
    const updated = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() };
    projects[idx] = updated;
    saveProjects(projects);
    return updated;
  }

  async removeProject(id: string): Promise<void> {
    const projects = loadProjects().filter(p => p.id !== id);
    saveProjects(projects);
  }

  async getHandoffs(projectId?: string): Promise<HandoffNote[]> {
    const notes = loadHandoffs();
    if (projectId) return notes.filter(n => n.projectId === projectId);
    return notes;
  }

  async addHandoff(input: Omit<HandoffNote, "id" | "createdAt">): Promise<HandoffNote> {
    const notes = loadHandoffs();
    const note: HandoffNote = {
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
    };
    notes.push(note);
    saveHandoffs(notes);
    return note;
  }

  async getState(): Promise<WorkspaceState> {
    return {
      projects: loadProjects(),
      isOnline: false,
      lastSyncAt: undefined,
    };
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

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await globalThis.fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${body}`);
    }
    return res.json();
  }

  async getProjects(): Promise<RegisteredProject[]> {
    return this.fetch("/projects");
  }

  async addProject(input: Omit<RegisteredProject, "id" | "createdAt" | "updatedAt">): Promise<RegisteredProject> {
    return this.fetch("/projects", { method: "POST", body: JSON.stringify(input) });
  }

  async updateProject(id: string, updates: Partial<RegisteredProject>): Promise<RegisteredProject> {
    return this.fetch(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
  }

  async removeProject(id: string): Promise<void> {
    await this.fetch(`/projects/${id}`, { method: "DELETE" });
  }

  async getHandoffs(projectId?: string): Promise<HandoffNote[]> {
    const query = projectId ? `?projectId=${projectId}` : "";
    return this.fetch(`/handoffs${query}`);
  }

  async addHandoff(input: Omit<HandoffNote, "id" | "createdAt">): Promise<HandoffNote> {
    return this.fetch("/handoffs", { method: "POST", body: JSON.stringify(input) });
  }

  async getState(): Promise<WorkspaceState> {
    return this.fetch("/workspace/state");
  }

  isOnline(): boolean {
    return true;
  }
}

let activeAdapter: WorkspaceAdapter = new LocalWorkspaceAdapter();

export function getAdapter(): WorkspaceAdapter {
  return activeAdapter;
}

export function setAdapter(adapter: WorkspaceAdapter): void {
  activeAdapter = adapter;
}
