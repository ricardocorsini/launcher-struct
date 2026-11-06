import { readFile, stat, writeFile } from 'node:fs/promises';
import { loadTrust, packageMessage, publicRaw, sha256, signBytes } from './security.mjs';
import assert from 'node:assert/strict';
import { valid } from 'semver';

try {
  const [path, metadataPath, keyPath, output] = process.argv.slice(2);
  if (!output)
    throw new Error(
      'Uso: npm run package:sign -- pacote.AppImage metadata.json private.pem asset.json',
    );
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const { appId, version, ...asset } = metadata;
  assert.ok(/^[a-z][a-z0-9-]{0,63}$/.test(appId) && valid(version), 'Aplicativo/versão inválidos');
  assert.ok(['x86_64', 'aarch64'].includes(asset.arch) && valid(asset.minLauncherVersion));
  assert.ok(
    (asset.platform === 'linux' && asset.kind === 'appimage') ||
      (asset.platform === 'windows' && asset.kind === 'nsis'),
  );
  const trust = await loadTrust();
  const pem = await readFile(keyPath, 'utf8');
  assert.equal(
    trust.keys[asset.keyId],
    publicRaw(pem),
    'Chave não corresponde ao registro confiável',
  );
  const url = new URL(asset.url);
  assert.ok(url.protocol === 'https:' && trust.allowedHosts.includes(url.hostname));
  asset.size = (await stat(path)).size;
  asset.sha256 = await sha256(path);
  asset.executable ??= null;
  asset.signature = signBytes(packageMessage(appId, version, asset), pem);
  await writeFile(output, `${JSON.stringify(asset, null, 2)}\n`, { flag: 'wx' });
  console.log(
    `Metadados assinados em ${output}. Inclua-os na versão ${version} do catálogo e valide o catálogo completo.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
