import { readFile, writeFile } from 'node:fs/promises';
import { loadTrust, publicRaw, signBytes, validateCatalog } from './security.mjs';

try {
  const [path, keyPath, keyId, output] = process.argv.slice(2);
  if (!output)
    throw new Error(
      'Uso: npm run catalog:sign -- catalog.json private.pem key-id catalog.signed.json',
    );
  const trust = await loadTrust();
  const pem = await readFile(keyPath, 'utf8');
  if (trust.keys[keyId] !== publicRaw(pem))
    throw new Error('A chave privada não corresponde à chave pública configurada');
  const catalog = validateCatalog(JSON.parse(await readFile(path, 'utf8')), trust);
  const payload = JSON.stringify(catalog);
  await writeFile(
    output,
    `${JSON.stringify({ payload, signature: signBytes(payload, pem), keyId }, null, 2)}\n`,
    { flag: 'wx' },
  );
  console.log(`Catálogo assinado em ${output}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
