import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { packageMessage, validateCatalog, verifyBytes } from './security.mjs';

const vector = JSON.parse(
  await readFile(new URL('../tests/fixtures/signature-vector.json', import.meta.url), 'utf8'),
);
const trust = { keys: { 'test-only': vector.publicKey }, allowedHosts: ['github.com'] };
test('assinatura do pacote é compartilhada com o teste Rust', () => {
  assert.ok(
    verifyBytes(
      packageMessage(vector.appId, vector.version, vector.asset),
      vector.asset.signature,
      vector.publicKey,
    ),
  );
  assert.ok(
    !verifyBytes(
      packageMessage('outro-app', vector.version, vector.asset),
      vector.asset.signature,
      vector.publicKey,
    ),
  );
});
test('catálogo assina os bytes exatos do payload', () => {
  assert.ok(verifyBytes(vector.envelope.payload, vector.envelope.signature, vector.publicKey));
  assert.ok(
    !verifyBytes(`${vector.envelope.payload} `, vector.envelope.signature, vector.publicKey),
  );
});
test('validação rejeita catálogo com metadados de pacote alterados', () => {
  const catalog = JSON.parse(vector.envelope.payload);
  validateCatalog(catalog, trust);
  catalog.apps[0].releases[0].assets[0].size++;
  assert.throws(() => validateCatalog(catalog, trust), /Assinatura/);
});
test('validação rejeita URL fora da política e chaves não configuradas', () => {
  const catalog = JSON.parse(vector.envelope.payload);
  assert.throws(() => validateCatalog(catalog, { keys: {}, allowedHosts: ['github.com'] }));
  catalog.apps[0].releases[0].assets[0].url = 'https://example.org/file';
  assert.throws(() => validateCatalog(catalog, trust), /Origem/);
});
