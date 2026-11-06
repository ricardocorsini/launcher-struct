import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { publicRaw } from '../security.mjs';
import { distributionEndpoints, seal } from './release-lib.mjs';
import { api, gh, putFiles } from './github.mjs';
import { prepareHub, renderHubTemplate } from './hub.mjs';
import { formatProductFiles, releaseWorkflow } from './product-files.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'npm run distribution:init -- --hub OWNER/openstruct-catalog --create-public\n' +
      'Requer gh auth login. Guarda chaves em private-keys/distribution; envie uma cópia ao seu cofre.\n' +
      'Opcional: OPENSTRUCT_DISTRIBUTION_TOKEN no ambiente (PAT fino, só Contents:write no hub).',
  );
  process.exit(0);
}
const hubRepo = args[args.indexOf('--hub') + 1];
assert.ok(
  args.includes('--hub') && /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(hubRepo ?? ''),
  'Informe --hub OWNER/REPO',
);
assert.ok(
  ![
    'ricardocorsini/launcher-struct',
    'ricardocorsini/mola-struct',
    'ricardocorsini/consolo-struct',
  ].includes(hubRepo),
  'Use um repositório separado para a distribuição',
);
gh(['auth', 'status']);
const launcherRepo = 'ricardocorsini/launcher-struct';
const products = [
  { id: 'molastruct', name: 'MolaStruct', sourceRepo: 'ricardocorsini/mola-struct' },
  { id: 'consolostruct', name: 'ConsoloStruct', sourceRepo: 'ricardocorsini/consolo-struct' },
  { id: 'launcher', name: 'Struct Launcher', sourceRepo: launcherRepo },
].map((product) => ({
  ...product,
  releaseRepo: product.id === 'launcher' ? hubRepo : product.sourceRepo,
  keyId: `${product.id}-packages-v1`,
}));
for (const product of products) {
  const repo = api(`repos/${product.sourceRepo}`);
  assert.ok(repo.permissions?.admin, `Acesso de administrador necessário: ${product.sourceRepo}`);
  if (product.id !== 'launcher')
    assert.equal(repo.private, false, 'Os instaladores dos apps precisam ser públicos');
}
const { branch: hubBranch, tree: hubTree } = prepareHub(hubRepo, args.includes('--create-public'));
console.log(`Hub: ${hubRepo} · branch ${hubBranch}`);
let previousConfig;
if (hubTree.tree.some((file) => file.path === 'distribution.json')) {
  previousConfig = JSON.parse(
    Buffer.from(
      api(`repos/${hubRepo}/contents/distribution.json?ref=${encodeURIComponent(hubBranch)}`)
        .content,
      'base64',
    ).toString(),
  );
} else {
  assert.ok(
    hubTree.tree.filter((file) => file.type === 'blob').every((file) => file.path === 'README.md'),
    'O hub contém outro projeto. Escolha um repositório vazio dedicado à distribuição.',
  );
}
const keyDir = join(root, 'private-keys/distribution');
await mkdir(keyDir, { recursive: true, mode: 0o700 });
await chmod(keyDir, 0o700);
async function edKey(id) {
  const path = join(keyDir, `${id}.pem`);
  let pem;
  try {
    pem = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    assert.ok(
      !previousConfig,
      'Chaves locais ausentes. Restaure seu backup; não gere outras para uma instalação existente.',
    );
    pem = generateKeyPairSync('ed25519')
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString();
    await writeFile(path, pem, { mode: 0o600, flag: 'wx' });
  }
  await chmod(path, 0o600);
  return pem;
}
const catalogKeyId = 'catalog-v1';
const catalogPem = await edKey(catalogKeyId);
const privateKeys = {};
const publicKeys = { [catalogKeyId]: publicRaw(catalogPem) };
for (const product of products) {
  privateKeys[product.id] = await edKey(product.keyId);
  publicKeys[product.keyId] = publicRaw(privateKeys[product.id]);
}
if (previousConfig)
  assert.deepEqual(
    previousConfig.publicKeys,
    publicKeys,
    'Chaves diferentes das já publicadas. Restaure o backup.',
  );
const tauriPath = join(keyDir, 'launcher-tauri.key');
try {
  await readFile(tauriPath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  assert.ok(!previousConfig, 'Restaure também a chave Tauri do backup.');
  const generated = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
      'signer',
      'generate',
      '--ci',
      '--password',
      '',
      '--write-keys',
      tauriPath,
    ],
    { stdio: 'pipe', encoding: 'utf8', shell: false },
  );
  assert.equal(generated.status, 0, 'Não foi possível gerar a chave Tauri. Execute npm ci.');
}
await chmod(tauriPath, 0o600);
const tauriKey = (await readFile(tauriPath, 'utf8')).trim();
const tauriPublicKey = (await readFile(`${tauriPath}.pub`, 'utf8')).trim();
if (previousConfig)
  assert.equal(previousConfig.tauriPublicKey, tauriPublicKey, 'Chave Tauri diferente da publicada');
const config = {
  schemaVersion: 1,
  hubRepo,
  hubBranch,
  catalogKeyId,
  publicKeys,
  tauriPublicKey,
  products,
};
const trust = JSON.parse(await readFile(join(root, 'catalog/trust.json'), 'utf8'));
const { catalogUrl, updateUrl } = distributionEndpoints(config);
trust.catalogUrl = catalogUrl;
trust.keys = { ...trust.keys, ...publicKeys };
const secret = (repo, name, value) => gh(['secret', 'set', name, '--repo', repo], value);
const variable = (repo, name, value) =>
  gh(['variable', 'set', name, '--repo', repo, '--body', value]);
// Validate ALL public keys before changing any secret or public configuration.
secret(hubRepo, 'OPENSTRUCT_CATALOG_KEY', catalogPem);
for (const product of products)
  secret(product.sourceRepo, 'OPENSTRUCT_PACKAGE_KEY', privateKeys[product.id]);
secret(launcherRepo, 'TAURI_SIGNING_PRIVATE_KEY', tauriKey);
variable(launcherRepo, 'STRUCT_LAUNCHER_UPDATE_URL', updateUrl);
variable(launcherRepo, 'STRUCT_LAUNCHER_UPDATE_PUBKEY', tauriPublicKey);
const mirrorToken = process.env.OPENSTRUCT_DISTRIBUTION_TOKEN;
if (mirrorToken) {
  assert.ok(mirrorToken.trim());
  for (const product of products)
    secret(product.sourceRepo, 'OPENSTRUCT_DISTRIBUTION_TOKEN', mirrorToken);
}
const files = [];
async function addDirectory(path, destination = '') {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = [destination, entry.name].filter(Boolean).join('/');
    if (entry.isDirectory()) await addDirectory(join(path, entry.name), target);
    else if (entry.isFile())
      files.push({
        path: target,
        content: renderHubTemplate(await readFile(join(path, entry.name), 'utf8'), hubBranch),
      });
  }
}
await addDirectory(join(root, 'distribution/hub'));
for (const path of ['scripts/security.mjs', 'LICENSE'])
  files.push({ path, content: await readFile(join(root, path), 'utf8') });
for (const name of [
  'release-lib.mjs',
  'github.mjs',
  'preflight.mjs',
  'prepare.mjs',
  'collect.mjs',
  'publish.mjs',
  'sync-catalog.mjs',
  'commit-catalog.mjs',
]) {
  const path = `scripts/distribution/${name}`;
  files.push({ path, content: await readFile(join(root, path), 'utf8') });
}
files.push(
  { path: 'distribution.json', content: JSON.stringify(config, null, 2) + '\n' },
  { path: 'catalog/trust.json', content: JSON.stringify(trust, null, 2) + '\n' },
  {
    path: 'catalog/bundled.json',
    content: await readFile(join(root, 'catalog/bundled.json'), 'utf8'),
  },
);
// A fresh endpoint is usable immediately, even before the first app release.
if (!previousConfig)
  files.push({
    path: 'catalog.signed.json',
    content:
      JSON.stringify(
        seal(
          JSON.parse(await readFile(join(root, 'catalog/bundled.json'), 'utf8')),
          catalogPem,
          catalogKeyId,
        ),
        null,
        2,
      ) + '\n',
  });
const pinned = putFiles(
  hubRepo,
  hubBranch,
  files,
  'feat: configure signed OpenStruct distribution',
);
for (const product of products) {
  const repo = api(`repos/${product.sourceRepo}`);
  const sourceHead = api(
    `repos/${product.sourceRepo}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`,
  ).object.sha;
  const sourceTree = api(`repos/${product.sourceRepo}/git/trees/${sourceHead}?recursive=1`);
  assert.equal(sourceTree.truncated, false, 'Árvore de código excede o limite');
  const sourceReady = sourceTree.tree.some((file) => file.path === 'src-tauri/tauri.conf.json');
  if (!sourceReady) {
    console.log(
      `${product.name}: aguardando código desktop no repositório; nenhuma tag será criada.`,
    );
    continue;
  }
  const changes = [
    {
      path: '.github/workflows/release.yml',
      content: releaseWorkflow({ product, hubRepo, pinned }),
    },
  ];
  const packageFile = api(`repos/${product.sourceRepo}/contents/package.json?ref=${sourceHead}`);
  const packageJson = JSON.parse(Buffer.from(packageFile.content, 'base64').toString());
  packageJson.scripts = {
    ...packageJson.scripts,
    'release:version': 'node scripts/openstruct-version.mjs',
  };
  changes.push(
    { path: 'package.json', content: JSON.stringify(packageJson, null, 2) + '\n' },
    {
      path: 'scripts/openstruct-version.mjs',
      content: await readFile(join(root, 'scripts/openstruct-version.mjs'), 'utf8'),
    },
  );
  if (product.id === 'launcher')
    changes.push({ path: 'catalog/trust.json', content: JSON.stringify(trust, null, 2) + '\n' });
  const formattedChanges = await formatProductFiles({
    repository: product.sourceRepo,
    ref: sourceHead,
    tree: sourceTree,
    files: changes,
  });
  putFiles(
    product.sourceRepo,
    repo.default_branch,
    formattedChanges,
    'ci: connect signed OpenStruct release publishing',
    undefined,
    sourceHead,
  );
}
// workflows become available asynchronously after the first commit.
try {
  gh(['workflow', 'run', 'catalog.yml', '--repo', hubRepo, '--ref', hubBranch]);
} catch {
  console.log(
    `Na aba Actions de ${hubRepo}, execute Synchronize signed catalog na branch ${hubBranch}.`,
  );
}
console.log(
  `Distribuição configurada: https://github.com/${hubRepo}\n` +
    `Faça backup seguro de ${resolve(keyDir)}. Não envie suas chaves ou tokens pelo chat.\n` +
    'Nenhuma versão foi lançada. O próximo passo é criar uma tag depois de revisar a versão.',
);
if (!mirrorToken)
  console.log(
    'Launcher privado: antes de publicá-lo, configure OPENSTRUCT_DISTRIBUTION_TOKEN nos Secrets do launcher.\n' +
      'Use um PAT fino limitado ao hub com Contents:read/write. Para os aplicativos, o catálogo periódico funciona sem esse token.',
  );
