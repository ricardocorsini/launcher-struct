import { expect, test } from '@playwright/test';
import bundled from '../../catalog/bundled.json' with { type: 'json' };
import type { Snapshot } from '../../src/types';

test('consulta ao abrir, avisa sem instalar e volta a consultar após 15 minutos', async ({
  page,
}) => {
  const initial: Snapshot = {
    revision: 1,
    catalog: structuredClone(bundled),
    settings: {
      theme: 'light',
      language: 'pt-BR',
      channel: 'stable',
      checkOnStart: true,
      installRoot: '/tmp/test-apps',
      catalogUrl: 'https://github.com/test/catalog',
      hiddenApps: [],
    },
    inventory: {
      molastruct: {
        appId: 'molastruct',
        name: 'MolaStruct',
        version: '0.2.0',
        kind: 'appimage',
        root: '/tmp/test-apps/molastruct',
        executable: '/tmp/test-apps/molastruct/app',
        executableSha256: '',
        installedAt: '',
        present: true,
        modified: false,
        previousVersion: null,
      },
    },
    jobs: [],
    platform: 'linux',
    arch: 'x86_64',
    native: true,
    catalogSource: 'bundled',
    checkedAt: null,
    warnings: [],
    runningApps: [],
    launcherVersion: '0.2.0',
  };
  const refreshed = structuredClone(initial);
  refreshed.revision = 2;
  refreshed.catalogSource = 'remote';
  refreshed.catalog.apps.find((app) => app.id === 'molastruct')!.releases = [
    {
      version: '0.3.0',
      channel: 'stable',
      publishedAt: '2026-11-06T00:00:00Z',
      notes: 'Fixture de teste',
      assets: [
        {
          platform: 'linux',
          arch: 'x86_64',
          kind: 'appimage',
          url: 'https://github.com/test/package',
          size: 1024,
          sha256: 'a'.repeat(64),
          signature: 'test-only',
          keyId: 'test-only',
          minLauncherVersion: '0.2.0',
          executable: null,
        },
      ],
    },
  ];
  await page.clock.install();
  await page.addInitScript(
    ({ initial, refreshed }) => {
      let state = initial;
      const calls: string[] = [];
      const runtime = window as unknown as Record<string, unknown>;
      runtime.isTauri = true;
      runtime.__testNativeCalls = calls;
      runtime.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      runtime.__TAURI_INTERNALS__ = {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string) => {
          calls.push(command);
          if (command === 'get_snapshot') return state;
          if (command === 'refresh_catalog') {
            state = refreshed;
            return state;
          }
          if (command === 'check_launcher_update')
            return { configured: true, version: '0.3.0', notes: 'Fixture de teste' };
          if (command.startsWith('plugin:event|')) return 1;
          throw new Error(`Comando inesperado no teste: ${command}`);
        },
      };
    },
    { initial, refreshed },
  );
  await page.goto('/');
  await expect(page.getByText('Struct Launcher 0.3.0', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver atualizações', exact: true })).toBeVisible();
  const calls = () =>
    page.evaluate(() => (window as unknown as { __testNativeCalls: string[] }).__testNativeCalls);
  expect((await calls()).filter((command) => command === 'install_app')).toHaveLength(0);
  const firstCount = (await calls()).filter((command) => command === 'refresh_catalog').length;
  await page.clock.fastForward(15 * 60 * 1000);
  await expect
    .poll(async () => (await calls()).filter((command) => command === 'refresh_catalog').length)
    .toBe(firstCount + 1);
  await page.getByRole('button', { name: 'Ver atualizações', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-title')).toHaveText('MolaStruct');
  expect(
    (await calls()).filter(
      (command) => command === 'install_app' || command === 'install_launcher_update',
    ),
  ).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
