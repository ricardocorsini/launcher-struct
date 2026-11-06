import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { valid } from 'semver';
import { api } from './github.mjs';

const configNames = new Set([
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.toml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  '.prettierrc.cts',
  '.prettierrc.mts',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
  'prettier.config.cts',
  'prettier.config.mts',
  '.editorconfig',
  '.prettierignore',
  'package.json',
]);

function runFormatter({ cwd, paths, version }) {
  assert.ok(process.env.npm_execpath, 'Execute o inicializador por npm run distribution:init.');
  const result = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      'exec',
      '--yes',
      '--ignore-scripts',
      `--package=prettier@${version}`,
      '--',
      'prettier',
      '--write',
      ...paths,
    ],
    { cwd, stdio: 'pipe', encoding: 'utf8', shell: false, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(
    result.status,
    0,
    'Não foi possível formatar os arquivos gerados com o Prettier do produto. ' +
      (result.error?.message || result.stderr || '').slice(0, 1500),
  );
}

// Format only the generated files, using the target project's lockfile and
// configuration. Keep this isolated from both the source checkout and signing keys.
export async function formatProductFiles({ repository, ref, tree, files }, client = {}) {
  const request = client.api ?? api;
  const formatFiles = client.runFormatter ?? runFormatter;
  const readRemote = (path) =>
    Buffer.from(
      request(`repos/${repository}/contents/${path}?ref=${encodeURIComponent(ref)}`).content,
      'base64',
    ).toString('utf8');
  assert.ok(
    tree.tree.some((file) => file.path === 'package-lock.json'),
    'O produto precisa de package-lock.json para fixar a versão do formatter.',
  );
  const lock = JSON.parse(readRemote('package-lock.json'));
  const version =
    lock.packages?.['node_modules/prettier']?.version || lock.dependencies?.prettier?.version;
  assert.ok(valid(version), 'Prettier precisa estar fixado no lockfile do produto.');
  const ancestors = new Set(['']);
  for (const file of files) {
    assert.ok(
      !file.path.startsWith('/') &&
        !/[\\:\u0000]/.test(file.path) &&
        file.path.split('/').every((part) => part && part !== '..' && part !== '.'),
      'Caminho de arquivo gerado inválido',
    );
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) ancestors.add(parts.slice(0, i).join('/'));
  }
  const inputs = new Map(files.map((file) => [file.path, file.content]));
  for (const entry of tree.tree.filter((entry) => entry.type === 'blob')) {
    const parts = entry.path.split('/');
    const name = parts.pop();
    if (ancestors.has(parts.join('/')) && configNames.has(name) && !inputs.has(entry.path))
      inputs.set(entry.path, readRemote(entry.path));
  }
  const directory = await mkdtemp(join(tmpdir(), 'openstruct-format-'));
  try {
    for (const [path, content] of inputs) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), content);
    }
    await formatFiles({ cwd: directory, paths: files.map((file) => file.path), version });
    return await Promise.all(
      files.map(async (file) => ({
        ...file,
        content: await readFile(join(directory, file.path), 'utf8'),
      })),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function releaseWorkflow({ product, hubRepo, pinned, branch = 'master' }) {
  return `name: Publish release
on:
  push:
    branches: [${JSON.stringify(branch)}]
    tags: ['v*']
    paths: ['.github/release-request.json']
  workflow_dispatch:
    inputs:
      tag:
        description: 'Tag da versão, por exemplo v0.5.0'
        required: true
        type: string
permissions:
  contents: write
jobs:
  prepare:
    runs-on: ubuntu-22.04
    outputs:
      tag: \${{ steps.version.outputs.tag }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
        with:
          node-version: '22'
      - run: node --test scripts/distribution/request-release.test.mjs
      - name: Prepare the version without replacing published tags
        id: version
        run: node scripts/openstruct-release-request.mjs
        env:
          GH_TOKEN: \${{ github.token }}
          RELEASE_INPUT_TAG: \${{ inputs.tag }}
  release:
    needs: prepare
    uses: ${hubRepo}/.github/workflows/release-product.yml@${pinned}
    with:
      product-id: ${product.id}
      tag: \${{ needs.prepare.outputs.tag }}
      distribution-repo: ${hubRepo}
      tooling-ref: ${pinned}
    secrets:
      package-signing-key: \${{ secrets.OPENSTRUCT_PACKAGE_KEY }}
      distribution-token: \${{ secrets.OPENSTRUCT_DISTRIBUTION_TOKEN }}
${product.id === 'launcher' ? '      tauri-signing-key: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}\n' : ''}`;
}
