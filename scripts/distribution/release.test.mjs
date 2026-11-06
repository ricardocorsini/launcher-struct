import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { packageMessage, publicRaw, signBytes } from '../security.mjs';
import {
  assembleCatalog,
  channelFor,
  launcherFeed,
  missingUploads,
  open,
  requireSigningKey,
  seal,
  tauriReleaseConfig,
  verifyRelease,
  versionFromTag,
} from './release-lib.mjs';

const pem = generateKeyPairSync('ed25519')
  .privateKey.export({ format: 'pem', type: 'pkcs8' })
  .toString();
const publicKey = publicRaw(pem);
const trust = { keys: { 'test-packages': publicKey }, allowedHosts: ['github.com'] };
const base = JSON.parse(
  await readFile(new URL('../../catalog/bundled.json', import.meta.url), 'utf8'),
);

test('build do launcher inclui a chave pública no config Tauri usado para assinar os artefatos', () => {
  const config = tauriReleaseConfig(
    'launcher',
    'https://github.com/test/latest.json',
    'test-public-key',
  );
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.pubkey, 'test-public-key');
  assert.equal(config.plugins.updater.endpoints[0], 'https://github.com/test/latest.json');
  assert.equal(tauriReleaseConfig('molastruct').bundle.createUpdaterArtifacts, false);
  assert.throws(() => tauriReleaseConfig('launcher', null, null));
});

test('retomada do upload aceita somente arquivos idênticos em rascunho e nunca sobrescreve', () => {
  const local = [
    { name: 'app.exe', sha256: 'a'.repeat(64) },
    { name: 'metadata.json', sha256: 'b'.repeat(64) },
  ];
  const draft = {
    draft: true,
    assets: [{ name: 'app.exe', state: 'uploaded', digest: `sha256:${local[0].sha256}` }],
  };
  assert.deepEqual(missingUploads(local, draft), [local[1]]);
  assert.throws(() => missingUploads(local, { ...draft, draft: false }));
  draft.assets[0].digest = `sha256:${'c'.repeat(64)}`;
  assert.throws(() => missingUploads(local, draft));
});
function fixture(version = '0.3.0', id = 'molastruct') {
  const product = {
    id,
    keyId: 'test-packages',
    sourceRepo: 'owner/app',
    releaseRepo: 'owner/public-releases',
  };
  const tag = `v${version}`;
  const releaseTag = `${id}-${tag}`;
  const assets = ['windows', 'linux'].map((platform) => {
    const name = `${id}-${version}-${platform}${platform === 'windows' ? '.exe' : '.AppImage'}`;
    const asset = {
      name,
      platform,
      arch: 'x86_64',
      kind: platform === 'windows' ? 'nsis' : 'appimage',
      url: `https://github.com/${product.releaseRepo}/releases/download/${releaseTag}/${name}`,
      size: 1234,
      sha256: 'a'.repeat(64),
      keyId: product.keyId,
      minLauncherVersion: '0.2.0',
      executable: platform === 'windows' ? 'molasstruct.exe' : null,
      ...(id === 'launcher' ? { updaterSignature: 'valid-tauri-signature-'.repeat(8) } : {}),
    };
    asset.signature = signBytes(packageMessage(id, version, asset), pem);
    return asset;
  });
  const manifest = {
    schemaVersion: 1,
    appId: id,
    sourceRepo: product.sourceRepo,
    version,
    tag,
    channel: channelFor(version),
    notes: 'Correção da análise',
    assets,
  };
  const release = {
    tag_name: releaseTag,
    draft: false,
    prerelease: version.includes('-'),
    published_at: '2026-11-07T12:00:00Z',
    assets: assets.map((asset) => ({
      name: asset.name,
      size: asset.size,
      state: 'uploaded',
      digest: `sha256:${asset.sha256}`,
      browser_download_url: asset.url,
    })),
  };
  return { product, manifest, release, envelope: () => seal(manifest, pem, product.keyId) };
}

test('tags e canais usam SemVer e recusam referências arbitrárias', () => {
  assert.equal(versionFromTag('v0.10.0'), '0.10.0');
  assert.equal(channelFor(versionFromTag('v1.0.0-beta.2')), 'beta');
  for (const value of ['main', 'v01.2.3', 'v1.2', 'v1.2.3+dev', 'v1.2.3;echo'])
    assert.throws(() => versionFromTag(value));
});
test('assinatura vincula metadados, chave e produto', () => {
  const f = fixture();
  assert.equal(verifyRelease(f.envelope(), f.release, f.product, trust).version, '0.3.0');
  const broken = f.envelope();
  broken.payload += ' ';
  assert.throws(() => open(broken, f.product.keyId, publicKey));
  assert.throws(() =>
    verifyRelease(f.envelope(), f.release, { ...f.product, id: 'consolostruct' }, trust),
  );
  assert.throws(() =>
    requireSigningKey(
      generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }),
      f.product.keyId,
      trust,
    ),
  );
});
test('recusa rascunho, pacote faltante, URL trocada, tamanho/digest errado e canal incorreto', () => {
  for (const tamper of [
    (f) => {
      f.release.draft = true;
    },
    (f) => {
      f.release.assets.pop();
    },
    (f) => {
      f.manifest.assets[0].url = 'https://github.com/other/file.exe';
    },
    (f) => {
      f.release.assets[0].size++;
    },
    (f) => {
      f.release.assets[0].digest = `sha256:${'b'.repeat(64)}`;
    },
    (f) => {
      f.release.prerelease = true;
    },
    (f) => {
      f.manifest.assets.push(f.manifest.assets[0]);
    },
    (f) => {
      f.manifest.assets[0].signature = 'A'.repeat(88);
    },
    (f) => {
      f.release.tag_name = 'v0.3.1';
    },
  ]) {
    const f = fixture();
    tamper(f);
    assert.throws(() => verifyRelease(f.envelope(), f.release, f.product, trust));
  }
});
test('catálogo mantém datas monotônicas, versões ordenadas e payload idêntico sem alteração', () => {
  const older = fixture('0.9.0');
  const newer = fixture('0.10.0');
  const releases = [older, newer].map((f) =>
    verifyRelease(f.envelope(), f.release, f.product, trust),
  );
  const next = assembleCatalog(base, { molastruct: releases }, trust, null, new Date('2026-11-08'));
  const app = next.apps.find((app) => app.id === 'molastruct');
  assert.deepEqual(
    app.releases.map((release) => release.version),
    ['0.10.0', '0.9.0'],
  );
  assert.ok(!('name' in app.releases[0].assets[0]), 'Esquema Rust não permite campos extras');
  assert.equal(
    assembleCatalog(base, { molastruct: releases }, trust, next, new Date('2026-11-09')),
    next,
  );
  const changed = assembleCatalog(
    base,
    { molastruct: [releases[1]] },
    trust,
    next,
    new Date('2020-01-01'),
  );
  assert.ok(Date.parse(changed.publishedAt) > Date.parse(next.publishedAt));
});
test('feed do launcher mantém stable separado de beta e inclui assinaturas Tauri', () => {
  const releases = ['0.2.0', '0.3.0-beta.1'].map((version) => {
    const f = fixture(version, 'launcher');
    return verifyRelease(f.envelope(), f.release, f.product, trust);
  });
  const feed = launcherFeed(releases);
  assert.equal(feed.version, '0.2.0');
  assert.deepEqual(Object.keys(feed.platforms), ['windows-x86_64', 'linux-x86_64']);
  assert.ok(feed.platforms['linux-x86_64'].signature);
  assert.equal(launcherFeed([]), null);
});
test('coletor exige um pacote por sistema e preserva a assinatura Tauri', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'struct-release-'));
  try {
    await mkdir(join(dir, 'target/release/bundle/appimage'), { recursive: true });
    await writeFile(join(dir, 'target/release/bundle/appimage/app.AppImage'), 'fixture');
    await writeFile(
      join(dir, 'target/release/bundle/appimage/app.AppImage.sig'),
      'fixture-signature',
    );
    await writeFile(
      join(dir, '.openstruct-release-plan.json'),
      JSON.stringify({ id: 'launcher', version: '0.2.0' }),
    );
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./collect.mjs', import.meta.url))],
      { cwd: dir, env: { ...process.env, RUNNER_OS: 'Linux' }, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(join(dir, 'release-output/launcher-0.2.0-linux-x86_64.AppImage.sig'), 'utf8'),
      'fixture-signature',
    );
    await writeFile(join(dir, 'target/release/bundle/appimage/duplicate.AppImage'), 'fixture');
    assert.notEqual(
      spawnSync(process.execPath, [fileURLToPath(new URL('./collect.mjs', import.meta.url))], {
        cwd: dir,
        env: { ...process.env, RUNNER_OS: 'Linux' },
      }).status,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sincronizador completo conserva o catálogo anterior em falha de API ou assinatura', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'struct catalog-ç#-'));
  const f = fixture();
  const metadataUrl = `https://github.com/${f.product.releaseRepo}/releases/download/${f.release.tag_name}/openstruct-release.json`;
  f.release.assets.push({
    name: 'openstruct-release.json',
    state: 'uploaded',
    size: 10000,
    browser_download_url: metadataUrl,
  });
  try {
    await mkdir(join(dir, 'catalog'));
    await writeFile(
      join(dir, 'distribution.json'),
      JSON.stringify({ catalogKeyId: f.product.keyId, products: [f.product] }),
    );
    await writeFile(join(dir, 'catalog/trust.json'), JSON.stringify(trust));
    await writeFile(join(dir, 'catalog/bundled.json'), JSON.stringify(base));
    const statePath = join(dir, 'fixture.json');
    const mockPath = join(dir, 'mock.mjs');
    await writeFile(
      mockPath,
      `import {readFile} from 'node:fs/promises';
      globalThis.fetch = async (url) => {
        const fixture = JSON.parse(await readFile(${JSON.stringify(statePath)}, 'utf8'));
        if(fixture.fail) return new Response('{}', {status: 503});
        return new Response(JSON.stringify(new URL(url).hostname === 'api.github.com'
          ? [fixture.release] : fixture.envelope), {headers: {'content-type': 'application/json'}});
      };`,
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(mockPath).href,
          fileURLToPath(new URL('./sync-catalog.mjs', import.meta.url)),
        ],
        { cwd: dir, env: { ...process.env, CATALOG_SIGNING_KEY: pem }, encoding: 'utf8' },
      );
    await writeFile(statePath, JSON.stringify({ release: f.release, envelope: f.envelope() }));
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const before = await readFile(join(dir, 'catalog.signed.json'), 'utf8');
    assert.equal(
      open(JSON.parse(before), f.product.keyId, publicKey).apps.find(
        (app) => app.id === 'molastruct',
      ).releases[0].version,
      '0.3.0',
    );
    assert.equal(run().status, 0);
    assert.equal(await readFile(join(dir, 'catalog.signed.json'), 'utf8'), before);
    await writeFile(statePath, JSON.stringify({ fail: true }));
    assert.notEqual(run().status, 0);
    assert.equal(await readFile(join(dir, 'catalog.signed.json'), 'utf8'), before);
    const invalid = f.envelope();
    invalid.payload += ' ';
    await writeFile(statePath, JSON.stringify({ release: f.release, envelope: invalid }));
    assert.notEqual(run().status, 0);
    assert.equal(await readFile(join(dir, 'catalog.signed.json'), 'utf8'), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('comando de versão sincroniza frontend, Tauri, Rust e lockfiles sem gerar tag', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'struct-version-'));
  try {
    await mkdir(join(dir, 'src-tauri'));
    await mkdir(join(dir, 'crates/core'), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version: '0.3.0' }));
    await writeFile(
      join(dir, 'package-lock.json'),
      JSON.stringify({ version: '0.3.0', packages: { '': { version: '0.3.0' } } }),
    );
    await writeFile(
      join(dir, 'src-tauri/tauri.conf.json'),
      JSON.stringify({ version: '0.3.0', app: { windows: [{ title: 'MolaStruct 0.3.0' }] } }),
    );
    await writeFile(
      join(dir, 'src-tauri/Cargo.toml'),
      '[package]\nname = "molasstruct"\nversion = "0.3.0"\n\n[dependencies]\n',
    );
    await writeFile(
      join(dir, 'crates/core/Cargo.toml'),
      '[package]\nname = "molas-core"\nversion = "0.3.0"\n',
    );
    await writeFile(
      join(dir, 'src-tauri/Cargo.lock'),
      '[[package]]\nname = "molasstruct"\nversion = "0.3.0"\n\n[[package]]\nname = "molas-core"\nversion = "0.3.0"\n',
    );
    const cli = fileURLToPath(new URL('../openstruct-version.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [cli, '0.4.0-beta.1'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(await readFile(join(dir, 'package.json'))).version, '0.4.0-beta.1');
    assert.equal(
      JSON.parse(await readFile(join(dir, 'src-tauri/tauri.conf.json'))).app.windows[0].title,
      'MolaStruct 0.4.0-beta.1',
    );
    assert.equal(
      JSON.parse(await readFile(join(dir, 'package-lock.json'))).packages[''].version,
      '0.4.0-beta.1',
    );
    assert.ok(!(await readFile(join(dir, 'src-tauri/Cargo.lock'), 'utf8')).includes('0.3.0'));
    assert.ok(
      (await readFile(join(dir, 'crates/core/Cargo.toml'), 'utf8')).includes(
        'version = "0.4.0-beta.1"',
      ),
    );
    assert.notEqual(spawnSync(process.execPath, [cli, '0.4.0-beta.01'], { cwd: dir }).status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('mesma identidade do publicador não permite trocar pacotes entre aplicativos', () => {
  const f = fixture('0.1.1', 'armadurastruct');
  f.product.publisherRepo = 'owner/launcher';
  f.manifest.publisherRepo = 'owner/launcher';
  f.manifest.sourceCommit = 'b'.repeat(40);
  assert.equal(verifyRelease(f.envelope(), f.release, f.product, trust).version, '0.1.1');
  const original = f.manifest.assets[0].signature;
  f.manifest.assets[0].signature = signBytes(
    packageMessage('launcher', '0.1.1', f.manifest.assets[0]),
    pem,
  );
  assert.throws(() => verifyRelease(f.envelope(), f.release, f.product, trust));
  f.manifest.assets[0].signature = original;
  f.manifest.publisherRepo = 'owner/other';
  assert.throws(() => verifyRelease(f.envelope(), f.release, f.product, trust));
});
