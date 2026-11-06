import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import bundled from '../catalog/bundled.json';
import type { Catalog, LauncherUpdate, Settings, Snapshot } from './types';

export const native = isTauri();
const DEFAULT: Settings = {
  theme: 'light',
  language: 'pt-BR',
  channel: 'stable',
  checkOnStart: true,
  installRoot: '',
  catalogUrl: null,
  hiddenApps: [],
};
function webSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem('struct-launcher-web-v1') ?? '{}');
    return {
      ...DEFAULT,
      theme: ['light', 'dark', 'system'].includes(raw.theme) ? raw.theme : 'light',
      language: raw.language === 'en' ? 'en' : 'pt-BR',
      channel: raw.channel === 'beta' ? 'beta' : 'stable',
      hiddenApps: Array.isArray(raw.hiddenApps)
        ? raw.hiddenApps.filter((s: unknown) => typeof s === 'string')
        : [],
    };
  } catch {
    return DEFAULT;
  }
}
function webSnapshot(): Snapshot {
  return {
    revision: Date.now(),
    catalog: bundled as Catalog,
    settings: webSettings(),
    inventory: {},
    jobs: [],
    platform: navigator.userAgent.includes('Windows') ? 'windows' : 'linux',
    arch: 'x86_64',
    native: false,
    catalogSource: 'bundled',
    checkedAt: null,
    warnings: [],
    runningApps: [],
    launcherVersion: '0.1.0',
  };
}
async function desktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!native)
    throw new Error('A instalação e a gestão de aplicativos estão disponíveis na versão desktop.');
  return invoke<T>(command, args);
}
export const bridge = {
  snapshot: () => (native ? invoke<Snapshot>('get_snapshot') : Promise.resolve(webSnapshot())),
  refresh: () => (native ? invoke<Snapshot>('refresh_catalog') : Promise.resolve(webSnapshot())),
  saveSettings: async (settings: Settings) => {
    if (native) return invoke<Snapshot>('save_settings', { settings });
    localStorage.setItem(
      'struct-launcher-web-v1',
      JSON.stringify({
        theme: settings.theme,
        language: settings.language,
        channel: settings.channel,
        hiddenApps: settings.hiddenApps,
      }),
    );
    return webSnapshot();
  },
  install: (appId: string, version: string, allowDowngrade = false) =>
    desktop<Snapshot>('install_app', { appId, version, allowDowngrade }),
  launch: (appId: string) => desktop<Snapshot>('launch_app', { appId }),
  uninstall: (appId: string) => desktop<Snapshot>('uninstall_app', { appId }),
  cancel: (jobId: string) => desktop<Snapshot>('cancel_job', { jobId }),
  clearHistory: () => desktop<Snapshot>('clear_history'),
  openFolder: (appId: string) => desktop<void>('open_app_folder', { appId }),
  openLink: async (appId: string, kind: 'website' | 'repository' | 'documentation') => {
    if (native) return invoke<void>('open_product_link', { appId, kind });
    const app = bundled.apps.find((a) => a.id === appId);
    if (app) window.open(app[kind], '_blank', 'noopener,noreferrer');
  },
  projectLink: async (kind: 'website' | 'repository' | 'help') => {
    if (native) return invoke<void>('open_project_link', { kind });
    const urls = {
      website: 'https://openstruct.com.br',
      repository: 'https://github.com/ricardocorsini/launcher-struct',
      help: 'https://github.com/ricardocorsini/launcher-struct/blob/master/docs/GUIA-DE-USO.md',
    };
    window.open(urls[kind], '_blank', 'noopener,noreferrer');
  },
  pickFolder: async () => {
    if (!native) return null;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const value = await open({
      directory: true,
      multiple: false,
      title: 'Pasta para os aplicativos OpenStruct',
    });
    return typeof value === 'string' ? value : null;
  },
  subscribe: async (handler: (snapshot: Snapshot) => void) =>
    native ? listen<Snapshot>('launcher-state', (event) => handler(event.payload)) : () => {},
  checkLauncher: () =>
    native
      ? invoke<LauncherUpdate>('check_launcher_update')
      : Promise.resolve({ configured: false, version: null, notes: null }),
  updateLauncher: (version: string) => desktop<void>('install_launcher_update', { version }),
  quit: () => desktop<void>('quit_launcher', { confirmed: true }),
  onCloseRequest: async (handler: () => void) =>
    native ? listen('launcher-close-requested', handler) : () => {},
};
