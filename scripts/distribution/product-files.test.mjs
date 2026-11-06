import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { check, format, resolveConfig } from 'prettier';
import { formatProductFiles, releaseWorkflow } from './product-files.mjs';
import { putFiles } from './github.mjs';

const workflow = () =>
  releaseWorkflow({
    product: { id: 'molastruct' },
    hubRepo: 'owner/catalog',
    pinned: 'a'.repeat(40),
  });
function clientFor(config, extra = {}) {
  const sources = {
    'package-lock.json': JSON.stringify({
      packages: { 'node_modules/prettier': { version: '3.6.2' } },
    }),
    '.prettierrc.json': JSON.stringify(config),
    'package.json': JSON.stringify({ name: 'test-product', type: 'module' }),
    ...extra,
  };
  const requests = [];
  const tree = { tree: Object.keys(sources).map((path) => ({ path, type: 'blob' })) };
  return {
    tree,
    requests,
    client: {
      api(path) {
        requests.push(path);
        assert.ok(path.endsWith('?ref=source-commit'));
        const file = path.split('/contents/')[1].split('?')[0];
        assert.ok(file in sources, 'Unexpected repository read');
        return { content: Buffer.from(sources[file]).toString('base64') };
      },
      async runFormatter({ cwd, paths, version }) {
        assert.equal(
          version,
          '3.6.2',
          'Use the lockfile version, not the launcher formatter version',
        );
        for (const path of paths) {
          const target = join(cwd, path);
          const options = await resolveConfig(target, { editorconfig: true, useCache: false });
          await writeFile(
            target,
            await format(await readFile(target, 'utf8'), { ...options, filepath: target }),
          );
        }
      },
    },
  };
}

test('arquivos gerados respeitam as configurações diferentes do MolaStruct e do launcher', async () => {
  const script = await readFile(new URL('../openstruct-version.mjs', import.meta.url), 'utf8');
  const files = [
    { path: '.github/workflows/release.yml', content: workflow() },
    { path: 'scripts/openstruct-version.mjs', content: script },
  ];
  for (const config of [
    { singleQuote: false, trailingComma: 'all' },
    { singleQuote: true, trailingComma: 'all', printWidth: 100 },
  ]) {
    const f = clientFor(config);
    const result = await formatProductFiles(
      { repository: 'owner/product', ref: 'source-commit', tree: f.tree, files },
      f.client,
    );
    for (const file of result)
      assert.ok(await check(file.content, { ...config, filepath: file.path }));
    assert.match(
      result[1].content,
      config.singleQuote ? /from 'node:assert\/strict'/ : /from "node:assert\/strict"/,
    );
    assert.equal(files[0].content, workflow(), 'Do not mutate the source inputs');
  }
});

test('configuração de formatter por diretório é aplicada aos arquivos gerados', async () => {
  const f = clientFor(
    { singleQuote: false },
    { 'scripts/.prettierrc.json': JSON.stringify({ singleQuote: true, semi: false }) },
  );
  const result = await formatProductFiles(
    {
      repository: 'owner/product',
      ref: 'source-commit',
      tree: f.tree,
      files: [{ path: 'scripts/generated.mjs', content: 'const name = "OpenStruct";\n' }],
    },
    f.client,
  );
  assert.equal(result[0].content, "const name = 'OpenStruct'\n");
  assert.ok(f.requests.some((path) => path.includes('scripts/.prettierrc.json')));
});

test('falha de formatação conserva os inputs e remove o diretório temporário', async () => {
  const f = clientFor({ singleQuote: false });
  let directory;
  f.client.runFormatter = async ({ cwd }) => {
    directory = cwd;
    throw new Error('Formatter unavailable');
  };
  const files = [{ path: 'scripts/generated.mjs', content: 'const value=1;' }];
  await assert.rejects(
    formatProductFiles(
      { repository: 'owner/product', ref: 'source-commit', tree: f.tree, files },
      f.client,
    ),
    /Formatter unavailable/,
  );
  await assert.rejects(access(directory), { code: 'ENOENT' });
  assert.equal(files[0].content, 'const value=1;');
});

test('versão inválida do formatter e caminhos fora do projeto são recusados', async () => {
  const badVersion = clientFor(
    {},
    {
      'package-lock.json': JSON.stringify({
        packages: { 'node_modules/prettier': { version: '^3.6.2' } },
      }),
    },
  );
  await assert.rejects(
    formatProductFiles(
      { repository: 'owner/product', ref: 'source-commit', tree: badVersion.tree, files: [] },
      badVersion.client,
    ),
    /lockfile/,
  );
  const f = clientFor({});
  await assert.rejects(
    formatProductFiles(
      {
        repository: 'owner/product',
        ref: 'source-commit',
        tree: f.tree,
        files: [{ path: '../outside.mjs', content: '' }],
      },
      f.client,
    ),
    /Caminho/,
  );
});

test('configuração não sobrescreve um projeto que mudou após a leitura dos arquivos', () => {
  let calls = 0;
  const request = () => {
    calls++;
    return { object: { sha: 'new-commit' } };
  };
  assert.throws(
    () => putFiles('owner/product', 'master', [], 'configure', request, 'old-commit'),
    /repositório mudou/,
  );
  assert.equal(calls, 1, 'No tree, commit or ref should be written from stale inputs');
});
