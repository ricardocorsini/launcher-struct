import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { validateGeostructRequest, verifyGeostructSource } from '../geostruct-release-request.mjs';

const request = { schemaVersion: 1, tag: 'v0.1.0', commit: 'a'.repeat(40), publish: false };

test('compilar e publicar exigem uma escolha explícita e um commit imutável', () => {
  assert.equal(validateGeostructRequest(request).publish, false);
  assert.equal(validateGeostructRequest({ ...request, publish: true }).publish, true);
  for (const patch of [
    { publish: undefined },
    { publish: 'true' },
    { commit: 'main' },
    { tag: 'v0.1.0;echo' },
    { schemaVersion: 2 },
  ])
    assert.throws(() => validateGeostructRequest({ ...request, ...patch }));
});

test('o preview confere os três manifests e a identidade do executável', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geostruct-source-'));
  try {
    await mkdir(join(root, 'src-tauri'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '0.1.0' }));
    const config = {
      version: '0.1.0',
      identifier: 'br.com.openstruct.geostruct',
      mainBinaryName: 'geostruct',
    };
    await writeFile(join(root, 'src-tauri/tauri.conf.json'), JSON.stringify(config));
    await writeFile(
      join(root, 'src-tauri/Cargo.toml'),
      '[package]\nname = "geostruct"\nversion = "0.1.0"\n',
    );
    await verifyGeostructSource(root, 'v0.1.0');
    await assert.rejects(verifyGeostructSource(root, 'v0.1.1'), /difere/);
    await writeFile(
      join(root, 'src-tauri/tauri.conf.json'),
      JSON.stringify({ ...config, mainBinaryName: 'outro' }),
    );
    await assert.rejects(verifyGeostructSource(root, 'v0.1.0'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
