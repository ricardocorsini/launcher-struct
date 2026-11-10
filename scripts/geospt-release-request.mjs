import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseVersion } from './openstruct-release-request.mjs';

export function validateGeosptRequest(request) {
  assert.equal(request.schemaVersion, 1);
  releaseVersion(request.tag);
  assert.match(request.commit ?? '', /^[a-f0-9]{40}$/, 'Informe o SHA completo do GeoSPT.');
  assert.equal(typeof request.publish, 'boolean', 'Escolha explicitamente compilar ou publicar.');
  return { tag: request.tag, commit: request.commit, publish: request.publish };
}

export async function verifyGeosptSource(root, tag) {
  const version = releaseVersion(tag);
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const config = JSON.parse(await readFile(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  const cargo = await readFile(resolve(root, 'src-tauri/Cargo.toml'), 'utf8');
  const section = cargo.match(/\[package\]([\s\S]*?)(?=\n\[|$)/)?.[1];
  assert.equal(pkg.version, version, 'package.json difere da versão solicitada.');
  assert.equal(config.version, version, 'Tauri difere da versão solicitada.');
  assert.equal(
    section?.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    version,
    'Cargo difere da versão solicitada.',
  );
  assert.equal(config.identifier, 'com.openstruct.geosptstruct');
  assert.equal(config.mainBinaryName, 'geosptstruct');
}

async function main() {
  if (process.argv.includes('--verify-source')) {
    await verifyGeosptSource('.', process.env.RELEASE_INPUT_TAG);
    console.log('GeoSPT: versão e identidade nativa conferidas.');
    return;
  }
  assert.equal(process.env.GITHUB_REPOSITORY, 'ricardocorsini/launcher-struct');
  let request;
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    assert.ok(['true', 'false'].includes(process.env.RELEASE_INPUT_PUBLISH));
    request = {
      schemaVersion: 1,
      tag: process.env.RELEASE_INPUT_TAG,
      commit: process.env.RELEASE_INPUT_COMMIT,
      publish: process.env.RELEASE_INPUT_PUBLISH === 'true',
    };
  } else {
    assert.equal(process.env.GITHUB_EVENT_NAME, 'push');
    assert.equal(process.env.GITHUB_REF, 'refs/heads/master');
    request = JSON.parse(await readFile('.github/geospt-release-request.json', 'utf8'));
  }
  const result = validateGeosptRequest(request);
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `tag=${result.tag}\ncommit=${result.commit}\npublish=${result.publish}\n`,
  );
  console.log(
    `GeoSPT: ${result.tag} · ${result.commit} · ${result.publish ? 'publicação assinada' : 'somente artefatos de validação'}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
