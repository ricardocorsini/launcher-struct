import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { prepareHub, renderHubTemplate } from './hub.mjs';
import { distributionBranch, distributionEndpoints } from './release-lib.mjs';
import { putFiles } from './github.mjs';

function fixture({
  branch = 'master',
  names = [branch],
  exists = true,
  privateRepo = false,
  size = 0,
} = {}) {
  const calls = [];
  const client = {
    gh(args) {
      calls.push({ args });
      assert.equal(args[0], 'repo');
      assert.equal(args[1], 'create');
      exists = true;
      names = [branch];
      return '';
    },
    api(path, method = 'GET', body) {
      calls.push({ path, method, body });
      if (path === 'repos/owner/hub') {
        if (!exists) throw new Error('HTTP 404');
        return { default_branch: branch, private: privateRepo, size, permissions: { admin: true } };
      }
      if (path === 'repos/owner/hub/branches?per_page=100') return names.map((name) => ({ name }));
      if (path === 'repos/owner/hub/contents/README.md' && method === 'PUT') {
        names = [branch];
        return {};
      }
      if (path.startsWith('repos/owner/hub/git/trees/'))
        return { truncated: false, tree: [{ type: 'blob', path: 'README.md' }] };
      throw new Error('Unexpected API call: ' + path);
    },
  };
  return { client, calls };
}

test('hub existente aceita main, master e branches com barra sem renomear nem reinicializar', () => {
  for (const branch of ['main', 'master', 'release/stable']) {
    const f = fixture({ branch });
    const hub = prepareHub('owner/hub', true, f.client);
    assert.equal(hub.branch, branch);
    assert.ok(
      f.calls.some(
        (call) =>
          call.path === `repos/owner/hub/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      ),
    );
    assert.ok(f.calls.every((call) => call.method === 'GET'));
  }
});

test('hub novo mantém a branch padrão criada pela conta', () => {
  const f = fixture({ exists: false });
  assert.equal(prepareHub('owner/hub', true, f.client).branch, 'master');
  assert.equal(f.calls.filter((call) => call.args?.[1] === 'create').length, 1);
  assert.ok(!f.calls.some((call) => call.path?.includes('/rename')));
});

test('repositório realmente vazio recebe o primeiro commit usando sua branch padrão', () => {
  const f = fixture({ names: [], size: 99 });
  assert.equal(prepareHub('owner/hub', false, f.client).branch, 'master');
  assert.equal(f.calls.filter((call) => call.method === 'PUT').length, 1);
  assert.ok(!f.calls.some((call) => call.path?.includes('/rename')));
});

test('metadados atrasados após renomeação usam a única branch que existe', () => {
  const f = fixture({ branch: 'master', names: ['main'] });
  assert.equal(prepareHub('owner/hub', false, f.client).branch, 'main');
  assert.ok(f.calls.every((call) => call.method === 'GET'));
});

test('não escolhe uma branch arbitrária quando o nome padrão ainda não está disponível', () => {
  const f = fixture({ branch: 'master', names: ['main', 'development'] });
  assert.throws(() => prepareHub('owner/hub', false, f.client), /branch padrão/);
  assert.ok(f.calls.every((call) => call.method === 'GET'));
});

test('não cria hub sem a opção explícita nem altera a visibilidade de um hub privado', () => {
  const missing = fixture({ exists: false });
  assert.throws(() => prepareHub('owner/hub', false, missing.client), /create-public/);
  assert.equal(missing.calls.length, 1);
  const privateHub = fixture({ privateRepo: true });
  assert.throws(() => prepareHub('owner/hub', true, privateHub.client), /público/);
  assert.equal(privateHub.calls.length, 1);
});

test('endpoints e workflow usam a mesma branch configurada e mantêm compatibilidade com hubs antigos', async () => {
  const template = await readFile(
    new URL('../../distribution/hub/.github/workflows/catalog.yml', import.meta.url),
    'utf8',
  );
  for (const branch of ['main', 'master', 'release/stable']) {
    const endpoints = distributionEndpoints({ hubRepo: 'owner/hub', hubBranch: branch });
    const base = `https://raw.githubusercontent.com/owner/hub/${encodeURIComponent(branch)}`;
    assert.equal(endpoints.catalogUrl, `${base}/catalog.signed.json`);
    assert.equal(endpoints.updateUrl, `${base}/launcher/latest.json`);
    const workflow = renderHubTemplate(template, branch);
    assert.equal(JSON.parse(workflow.match(/^\s+ref: (.+)$/m)[1]), branch);
    assert.ok(!workflow.includes('__OPENSTRUCT_HUB_BRANCH__'));
  }
  assert.equal(distributionBranch({ hubRepo: 'owner/hub' }), 'main');
  assert.throws(() => distributionBranch({ hubBranch: '' }), /inválida/);
});

test('commit do catálogo aponta para a branch escolhida, com a referência codificada', () => {
  const calls = [];
  const request = (path, method = 'GET', body) => {
    calls.push({ path, method, body });
    if (path.endsWith('/git/ref/heads/release%2Fstable')) return { object: { sha: 'parent' } };
    if (path.endsWith('/git/commits/parent')) return { tree: { sha: 'old-tree' } };
    if (path.endsWith('/git/trees')) return { sha: 'new-tree' };
    if (path.endsWith('/git/commits')) return { sha: 'commit' };
    if (method === 'PATCH') return {};
    throw new Error('Unexpected call');
  };
  assert.equal(
    putFiles(
      'owner/hub',
      'release/stable',
      [{ path: 'catalog.signed.json', content: '{}' }],
      'sync',
      request,
    ),
    'commit',
  );
  assert.equal(calls.at(-1).path, 'repos/owner/hub/git/refs/heads/release%2Fstable');
  assert.deepEqual(calls.at(-1).body, { sha: 'commit', force: false });
});
