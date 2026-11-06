import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { publicRaw } from './security.mjs';

try {
  const [directory, keyId] = process.argv.slice(2);
  if (!directory || !/^[a-z][a-z0-9-]{0,63}$/.test(keyId ?? ''))
    throw new Error('Uso: npm run keys:generate -- private-keys/catalog catalog-2026');
  const target = resolve(directory);
  await mkdir(target, { recursive: true, mode: 0o700 });
  const { privateKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  await writeFile(join(target, 'private.pem'), pem, { mode: 0o600, flag: 'wx' });
  const pub = { keyId, publicKey: publicRaw(pem) };
  await writeFile(join(target, 'public.json'), `${JSON.stringify(pub, null, 2)}\n`, { flag: 'wx' });
  console.log(
    `Chaves criadas em ${target}. Inclua somente a chave de public.json em catalog/trust.json. Não publique private.pem.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
