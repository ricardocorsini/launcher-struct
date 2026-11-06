import { readFile } from 'node:fs/promises';
import { loadTrust, validateCatalog } from './security.mjs';

try {
  const path = process.argv[2];
  if (!path) throw new Error('Uso: npm run catalog:validate -- caminho/catalog.json');
  const catalog = JSON.parse(await readFile(path, 'utf8'));
  validateCatalog(catalog, await loadTrust());
  console.log(
    `Catálogo válido: ${catalog.apps.length} aplicativos; ${catalog.apps.reduce((n, app) => n + app.releases.length, 0)} versões.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
