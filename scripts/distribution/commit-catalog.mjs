import { readFile } from 'node:fs/promises';
import { putFiles } from './github.mjs';

const config = JSON.parse(await readFile('distribution.json', 'utf8'));
if (process.env.GITHUB_REPOSITORY !== config.hubRepo)
  throw new Error('Repositório de catálogo incorreto');
const files = [];
for (const path of ['catalog.signed.json', 'launcher/latest.json']) {
  try {
    files.push({ path, content: await readFile(path, 'utf8') });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
putFiles(config.hubRepo, 'main', files, 'chore: update verified OpenStruct releases');
