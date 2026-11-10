import { describe, expect, it } from 'vitest';
import bundled from '../catalog/bundled.json';
import {
  appStatus,
  bytes,
  compatibleReleases,
  filterApps,
  needsUpdate,
  percentage,
  iconPath,
} from '../src/domain';
import type { Catalog, Product, Release, Snapshot } from '../src/types';

const snapshot = (): Snapshot => ({
  revision: 1,
  catalog: structuredClone(bundled) as Catalog,
  settings: {
    theme: 'light',
    language: 'pt-BR',
    channel: 'stable',
    checkOnStart: true,
    installRoot: '/tmp/apps',
    catalogUrl: null,
    hiddenApps: [],
  },
  inventory: {},
  jobs: [],
  platform: 'linux',
  arch: 'x86_64',
  native: true,
  catalogSource: 'bundled',
  checkedAt: null,
  warnings: [],
  runningApps: [],
  launcherVersion: '0.1.0',
});
const release = (
  version: string,
  platform = 'linux',
  channel = 'stable',
  minimum = '0.1.0',
): Release => ({
  version,
  channel,
  publishedAt: '2026-11-06T00:00:00Z',
  notes: '',
  assets: [
    {
      platform,
      arch: 'x86_64',
      kind: platform === 'linux' ? 'appimage' : 'nsis',
      url: 'https://github.com/example',
      size: 1024,
      sha256: '0'.repeat(64),
      signature: '',
      keyId: 'test',
      minLauncherVersion: minimum,
      executable: null,
    },
  ],
});
describe('seleção de pacotes e versões', () => {
  it('não oferece instalação quando não há pacote publicado', () =>
    expect(appStatus(snapshot().catalog.apps[0], snapshot())).toBe('unpublished'));
  it('compara versões numericamente', () => {
    const s = snapshot();
    const app: Product = { ...s.catalog.apps[0], releases: [release('0.9.0'), release('0.10.0')] };
    expect(compatibleReleases(app, s).map((r) => r.version)).toEqual(['0.10.0', '0.9.0']);
  });
  it('filtra sistema, arquitetura, canal e versão mínima do launcher', () => {
    const s = snapshot();
    const app = {
      ...s.catalog.apps[0],
      releases: [
        release('1.0.0', 'windows'),
        release('2.0.0-beta.1', 'linux', 'beta'),
        release('3.0.0', 'linux', 'stable', '9.0.0'),
        release('0.1.0'),
      ],
    };
    expect(compatibleReleases(app, s).map((r) => r.version)).toEqual(['0.1.0']);
    s.settings.channel = 'beta';
    expect(compatibleReleases(app, s)[0].version).toBe('2.0.0-beta.1');
  });
  it('não sinaliza downgrade como atualização', () => {
    const s = snapshot();
    const app = { ...s.catalog.apps[0], releases: [release('0.1.0')] };
    s.inventory[app.id] = {
      appId: app.id,
      name: app.name,
      version: '0.2.0',
      kind: 'appimage',
      root: '/tmp',
      executable: '/tmp/app',
      executableSha256: '',
      installedAt: '',
      present: true,
      modified: false,
      previousVersion: null,
    };
    expect(needsUpdate(app, s)).toBe(false);
    s.inventory[app.id].version = '0.0.1';
    expect(needsUpdate(app, s)).toBe(true);
    s.inventory[app.id].modified = true;
    expect(appStatus(app, s)).toBe('repair');
  });
});
describe('catálogo e progresso', () => {
  it('busca sem distinção de acentos', () =>
    expect(filterApps(snapshot(), 'all', 'fundacoes', 'all', 'az').map((a) => a.id)).toEqual([
      'geosptstruct',
      'molastruct',
    ]));
  it('combina busca, categoria e aplicativos ocultos', () => {
    const s = snapshot();
    s.settings.hiddenApps = ['molastruct'];
    expect(filterApps(s, 'all', '', 'all', 'az').map((app) => app.id)).toEqual([
      'armadurastruct',
      'consolostruct',
      'geosptstruct',
    ]);
    expect(filterApps(s, 'all', '', 'Fundações', 'az').map((app) => app.id)).toEqual([
      'geosptstruct',
    ]);
    expect(filterApps(s, 'all', '', 'Fundações', 'az', true)).toHaveLength(2);
  });
  it('mostra instalados e atualizações a partir do inventário real', () => {
    expect(filterApps(snapshot(), 'installed', '', 'all', 'az')).toHaveLength(0);
    expect(filterApps(snapshot(), 'updates', '', 'all', 'az')).toHaveLength(0);
  });
  it('limita o progresso e formata unidades', () => {
    expect(percentage({ total: 10, received: 50 } as never)).toBe(100);
    expect(percentage({ total: 0, received: 0 } as never)).toBe(0);
    expect(bytes(1048576)).toBe('1 MB');
  });
});

it('usa a identidade do ArmaduraStruct com o catálogo v1 compatível', () => {
  const app = bundled.apps.find((item) => item.id === 'armadurastruct')!;
  expect(app.icon).toBe('openstruct-mark');
  expect(iconPath(app)).toBe('/assets/armadurastruct-hephaestus.webp');
});

it('recebe o GeoSPT sem oferecer um pacote antes da publicação assinada', () => {
  const s = snapshot();
  const app = s.catalog.apps.find((item) => item.id === 'geosptstruct')!;
  expect(app.repository).toBe('https://github.com/itanervale/GEOSPT-STRUCT');
  expect(app.icon).toBe('openstruct-mark');
  expect(iconPath(app)).toBe('/assets/geosptstruct-athena.webp');
  expect(appStatus(app, s)).toBe('unpublished');
  expect(compatibleReleases(app, s)).toEqual([]);
});
