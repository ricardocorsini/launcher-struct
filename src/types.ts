export type Theme = 'light' | 'dark' | 'system';
export type Language = 'pt-BR' | 'en';
export interface Settings {
  theme: Theme;
  language: Language;
  channel: 'stable' | 'beta';
  checkOnStart: boolean;
  installRoot: string;
  catalogUrl: string | null;
  hiddenApps: string[];
}
export interface Package {
  platform: string;
  arch: string;
  kind: 'appimage' | 'nsis';
  url: string;
  size: number;
  sha256: string;
  signature: string;
  keyId: string;
  minLauncherVersion: string;
  executable: string | null;
}
export interface Release {
  version: string;
  channel: string;
  publishedAt: string;
  notes: string;
  assets: Package[];
}
export interface Product {
  id: string;
  name: string;
  tagline: string;
  summary: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  website: string;
  repository: string;
  documentation: string;
  features: string[];
  requirements: string;
  notice: string;
  releases: Release[];
}
export interface Catalog {
  schemaVersion: number;
  publishedAt: string;
  apps: Product[];
}
export interface Installed {
  appId: string;
  name: string;
  version: string;
  kind: string;
  root: string;
  executable: string;
  executableSha256: string;
  installedAt: string;
  present: boolean;
  modified: boolean;
  previousVersion: string | null;
}
export interface Job {
  id: string;
  appId: string;
  appName: string;
  version: string;
  phase: string;
  received: number;
  total: number;
  createdAt: string;
  error: string | null;
  allowDowngrade: boolean;
}
export interface Snapshot {
  revision: number;
  catalog: Catalog;
  settings: Settings;
  inventory: Record<string, Installed>;
  jobs: Job[];
  platform: string;
  arch: string;
  native: boolean;
  catalogSource: string;
  checkedAt: string | null;
  warnings: string[];
  runningApps: string[];
  launcherVersion: string;
}
export interface LauncherUpdate {
  configured: boolean;
  version: string | null;
  notes: string | null;
}
export type Page = 'all' | 'installed' | 'updates' | 'downloads' | 'settings';
