import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { validateGeosptRequest, verifyGeosptSource } from '../geospt-release-request.mjs';

const request = { schemaVersion: 1, tag: 'v2.0.7', commit: 'a'.repeat(40), publish: false };

test('compilar e publicar exigem uma escolha explícita e um commit imutável', () => {
  assert.equal(validateGeosptRequest(request).publish, false);
  assert.equal(validateGeosptRequest({ ...request, publish: true }).publish, true);
  for (const patch of [
    { publish: undefined },
    { publish: 'true' },
    { commit: 'main' },
    { tag: 'v2.0.7;echo' },
    { schemaVersion: 2 },
  ])
    assert.throws(() => validateGeosptRequest({ ...request, ...patch }));
});

test('o preview confere os três manifests e a identidade do executável', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geospt-source-'));
  try {
    await mkdir(join(root, 'src-tauri'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '2.0.7' }));
    const config = {
      version: '2.0.7',
      identifier: 'com.openstruct.geosptstruct',
      mainBinaryName: 'geosptstruct',
    };
    await writeFile(join(root, 'src-tauri/tauri.conf.json'), JSON.stringify(config));
    await writeFile(
      join(root, 'src-tauri/Cargo.toml'),
      '[package]\nname = "geosptstruct"\nversion = "2.0.7"\n',
    );
    await verifyGeosptSource(root, 'v2.0.7');
    await assert.rejects(verifyGeosptSource(root, 'v2.0.8'), /difere/);
    await writeFile(
      join(root, 'src-tauri/tauri.conf.json'),
      JSON.stringify({ ...config, mainBinaryName: 'outro' }),
    );
    await assert.rejects(verifyGeosptSource(root, 'v2.0.7'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
