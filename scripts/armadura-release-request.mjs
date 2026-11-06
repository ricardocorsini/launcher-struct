import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { releaseVersion } from './openstruct-release-request.mjs';

assert.equal(process.env.GITHUB_REPOSITORY, 'ricardocorsini/launcher-struct');
let request;
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
  request = {
    schemaVersion: 1,
    tag: process.env.RELEASE_INPUT_TAG,
    commit: process.env.RELEASE_INPUT_COMMIT,
  };
} else {
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/master');
  request = JSON.parse(await readFile('.github/armadura-release-request.json', 'utf8'));
}
assert.equal(request.schemaVersion, 1);
releaseVersion(request.tag);
assert.match(request.commit ?? '', /^[a-f0-9]{40}$/);
await appendFile(process.env.GITHUB_OUTPUT, `tag=${request.tag}\ncommit=${request.commit}\n`);
console.log(`ArmaduraStruct: ${request.tag} · ${request.commit}`);
