import assert from 'node:assert/strict';
import { api, gh } from './github.mjs';

// Keep the branch chosen by the repository owner. Renaming a default branch is
// asynchronous on GitHub and is unnecessary for a distribution repository.
export function prepareHub(hubRepo, allowCreate, client = { api, gh }) {
  let repo;
  try {
    repo = client.api(`repos/${hubRepo}`);
  } catch {
    assert.ok(allowCreate, 'O hub não está acessível. Para criá-lo, use --create-public');
    client.gh([
      'repo',
      'create',
      hubRepo,
      '--public',
      '--add-readme',
      '--description',
      'Catálogo assinado e distribuição OpenStruct',
    ]);
    repo = client.api(`repos/${hubRepo}`);
  }
  assert.equal(
    repo.private,
    false,
    'O hub existente precisa ser público; nenhuma visibilidade será alterada',
  );
  assert.ok(repo.permissions?.admin, 'Acesso de administrador necessário no hub');
  let branches = client.api(`repos/${hubRepo}/branches?per_page=100`);
  if (!branches.length) {
    client.api(`repos/${hubRepo}/contents/README.md`, 'PUT', {
      message: 'chore: initialize OpenStruct distribution',
      content: Buffer.from('# OpenStruct distribution\n').toString('base64'),
    });
    repo = client.api(`repos/${hubRepo}`);
    branches = client.api(`repos/${hubRepo}/branches?per_page=100`);
  }
  // A previous initialization may have completed a rename while repository
  // metadata still reports the old name. The single actual branch is authoritative.
  const branch = branches.some((item) => item.name === repo.default_branch)
    ? repo.default_branch
    : branches.length === 1
      ? branches[0].name
      : null;
  assert.ok(
    branch,
    'A branch padrão ainda não está disponível. Aguarde alguns segundos e execute novamente.',
  );
  const tree = client.api(`repos/${hubRepo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  assert.equal(tree.truncated, false, 'Árvore do hub excede o limite');
  return { repo, branch, tree };
}

export function renderHubTemplate(content, branch) {
  return content.replaceAll('__OPENSTRUCT_HUB_BRANCH__', JSON.stringify(branch));
}
