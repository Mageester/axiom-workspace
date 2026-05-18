import type { Repo } from "../types";

export const PLACEHOLDER_REPOS: Repo[] = [
  {
    id: "axiom-site",
    name: "Axiom Site",
    description: "Marketing site and documentation portal",
    status: "clean",
    branch: "main",
    lastSync: "2 minutes ago",
  },
  {
    id: "axiom-pipeline",
    name: "Axiom Pipeline Engine",
    description: "Core CI/CD pipeline orchestration engine",
    status: "dirty",
    branch: "feature/v2-migration",
    lastSync: "14 minutes ago",
  },
  {
    id: "client-repos",
    name: "Client Repos",
    description: "Aggregated client repository management",
    status: "behind",
    branch: "main",
    lastSync: "1 hour ago",
  },
];
