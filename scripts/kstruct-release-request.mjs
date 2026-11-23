import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { releaseVersion } from './openstruct-release-request.mjs';

assert.equal(process.env.GITHUB_REPOSITORY, 'ricardocorsini/launcher-struct');
assert.equal(process.env.GITHUB_REF, 'refs/heads/master');
const event = process.env.GITHUB_EVENT_NAME;
assert.ok(event === 'push' || event === 'workflow_dispatch');
const request =
  event === 'push'
    ? JSON.parse(await readFile('.github/kstruct-release-request.json', 'utf8'))
    : {
        schemaVersion: 1,
        tag: process.env.RELEASE_INPUT_TAG,
        commit: process.env.RELEASE_INPUT_COMMIT,
      };
assert.equal(request.schemaVersion, 1);
releaseVersion(request.tag);
assert.match(request.commit ?? '', /^[a-f0-9]{40}$/, 'Informe o SHA completo do KStruct.');
await appendFile(process.env.GITHUB_OUTPUT, `tag=${request.tag}\ncommit=${request.commit}\n`);
console.log(`KStruct ${request.tag} · ${request.commit}`);
