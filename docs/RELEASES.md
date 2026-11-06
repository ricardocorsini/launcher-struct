# GitHub Releases e atualizações do Struct Launcher

## Estado em 06/11/2026

- [MolaStruct 0.5.0 publicado](https://github.com/ricardocorsini/mola-struct/releases/tag/v0.5.0), com Windows x86_64 (NSIS), Linux x86_64 (AppImage), SHA-256 e manifesto assinado. Fonte imutável: `9cc4c390fa985ba25d34b99c912d25cb7d8dd8b9`.
- O catálogo oficial já inclui essa versão; as assinaturas e os hashes dos dois downloads foram conferidos.
- ConsoloStruct 0.6.0 conectado à mesma esteira. Seu código já foi enviado durante esta integração. A tag não foi criada porque o mantenedor ainda está revisando a primeira versão.
- As chaves públicas de produção estão configuradas. As chaves privadas permanecem nos Secrets e no backup do mantenedor.
- A primeira publicação dos binários do próprio launcher é uma etapa separada, descrita abaixo.

## O processo adotado

Uma alteração de código entra no Git normalmente. Uma **nova versão** é publicada quando
o mantenedor cria uma tag SemVer, como `v0.5.1`. O push dessa tag inicia o workflow:

1. Confere se a tag, o `package.json`, o Tauri e o Cargo estão na mesma versão.
2. Executa as verificações do projeto e compila Windows x64 (NSIS) e Linux x64 (AppImage).
3. Aguarda os dois sistemas terminarem. Uma falha impede a publicação de ambos.
4. Calcula SHA-256, assina os instaladores e o manifesto de release e envia todos os arquivos.
5. Publica a release completa. O catálogo público verifica a release e assina uma nova edição.
6. O launcher consulta o catálogo, compara com o inventário local e oferece **Atualizar**.

A instalação depende do usuário. Um commit comum não publica uma versão. Os ZIPs/TARs
automáticos de código-fonte do GitHub e os artefatos temporários do Actions não são os
instaladores usados pelo launcher.

## Organização dos repositórios

| Produto                | Código-fonte                        | Releases públicas                         |
| ---------------------- | ----------------------------------- | ----------------------------------------- |
| MolaStruct             | `ricardocorsini/mola-struct`        | No próprio repositório                    |
| ConsoloStruct          | `ricardocorsini/consolo-struct`     | No próprio repositório                    |
| Struct Launcher        | `ricardocorsini/launcher-struct`    | No hub público, tags `launcher-v…`        |
| Catálogo e ferramentas | `ricardocorsini/openstruct-catalog` | Endpoint estático e workflow reutilizável |

O hub separado permite distribuir o launcher sem mudar a visibilidade do repositório de
código. Os computadores dos usuários acessam somente URLs públicas: não precisam de conta
GitHub, token ou acesso aos fontes privados.

## Ativar uma única vez

Esta configuração já foi concluída para o ecossistema. O roteiro a seguir serve para
manutenção ou preparação de outro ambiente com o mesmo backup de chaves. O código contém
somente as chaves públicas; os Secrets são cadastrados pelo GitHub CLI autenticado.

No seu computador, instale Node.js 22.12+, npm, Git e o [GitHub CLI](https://cli.github.com/).
Abra o terminal e execute:

```sh
gh auth login --web --scopes workflow
git clone https://github.com/ricardocorsini/launcher-struct.git
cd launcher-struct
npm ci
npm run distribution:init -- --hub ricardocorsini/openstruct-catalog --create-public
```

Se você já possui esse checkout, use `git pull --ff-only` nele antes de `npm ci`, sem clonar
novamente. A autenticação precisa de acesso de administrador aos repositórios para gravar
Secrets e de permissão para atualizar workflows. O comando `--create-public` autoriza criar
**somente o novo hub** como público; não altera a visibilidade de repositórios existentes.
A branch existente do hub (`main`, `master` ou outro nome) é detectada e mantida. A configuração
gravada em `distribution.json` usa essa mesma branch nos endpoints, commits e workflows.

O inicializador:

- Cria o hub dedicado, ou confere que o hub informado já é público e pertence ao fluxo.
- Gera uma chave Ed25519 de catálogo e uma para cada produto, mais a chave Tauri do launcher.
- Guarda os arquivos de chave em `private-keys/distribution/`, ignorado pelo Git, e envia os
  Secrets diretamente ao GitHub pela entrada padrão do CLI.
- Publica somente as chaves públicas, a configuração, os workflows e o catálogo inicial.
- Configura as variáveis públicas de compilação do updater do launcher.
- Instala o workflow de release e o comando `release:version` nos produtos com código desktop.
- Formata os arquivos gerados com a versão de Prettier do lockfile e as configurações de cada
  produto, antes de gravar o commit. Esse passo pode baixar a versão necessária para o cache
  do npm e exige acesso ao registro de pacotes.
- Atualiza `catalog/trust.json` no repositório do launcher e inicia a sincronização do hub.
- Não cria tags nem publica aplicativos automaticamente durante a configuração.

Faça backup da pasta de chaves no seu cofre. As chaves não são exibidas no terminal pelo
inicializador. Reexecutar o comando reutiliza as mesmas chaves; se o hub já estiver configurado
e o backup local estiver ausente ou não corresponder às chaves publicadas, o processo para.
Não crie novas chaves para substituir silenciosamente as de uma versão já distribuída.

O inicializador deixa commits remotos nos repositórios. Antes de seguir no checkout local
do launcher ou de um app, execute `git pull --ff-only` para receber o workflow e a configuração
pública. O inicializador não modifica os arquivos de código do checkout local.

### Token para publicar o launcher privado no hub público

O `GITHUB_TOKEN` de um repositório só pode publicar no próprio repositório. Por isso, o
launcher privado precisa de um **fine-grained personal access token** com acesso apenas ao
hub público e permissão **Contents: read and write**. Crie-o em GitHub → Settings → Developer
settings → Personal access tokens → Fine-grained tokens. Escolha o proprietário, marque
somente `openstruct-catalog` e conceda a permissão indicada.

Depois configure o Secret no launcher, colando o token no prompt local do CLI:

```sh
gh secret set OPENSTRUCT_DISTRIBUTION_TOKEN --repo ricardocorsini/launcher-struct
```

Não coloque esse token em arquivos versionados, argumentos de shell ou no chat. Se já estiver
disponível de forma segura no ambiente como `OPENSTRUCT_DISTRIBUTION_TOKEN`, o inicializador
também pode cadastrá-lo. Sem esse Secret, a publicação do launcher para antes de compilar;
a publicação dos aplicativos públicos e a sincronização periódica do catálogo podem funcionar.

O mesmo Secret é **opcional** nos repositórios públicos dos apps. Com ele, a publicação avisa
o hub imediatamente por `repository_dispatch`. Sem ele, o hub encontra as novas releases
pela execução agendada. Não é necessário ampliar o token para incluir os repositórios dos apps.

## Publicar sem criar a tag no terminal

Em Actions → **Publish release → Run workflow**, escolha a branch padrão e informe a tag
SemVer. O workflow verifica package.json, Tauri e Cargo e cria a tag da versão selecionada
quando ela ainda não existe. Tags existentes são preservadas.

Outra opção é versionar uma solicitação em `.github/release-request.json`:

```json
{
  "schemaVersion": 1,
  "tag": "v0.5.0",
  "commit": "9cc4c390fa985ba25d34b99c912d25cb7d8dd8b9"
}
```

O exemplo acima corresponde à primeira publicação do MolaStruct. Use o SHA completo do
código revisado de cada produto. Um commit dessa solicitação na branch padrão dispara a
preparação da tag e os mesmos builds assinados. O commit que contém a solicitação pode ser
diferente do commit do código a distribuir: o SHA declarado é conferido e preservado.

Esse caminho permite ao mantenedor operar a publicação pelo GitHub, inclusive com ferramentas
que podem editar arquivos mas não têm uma operação específica para criar tags. O `GITHUB_TOKEN`
do próprio workflow executa a operação autorizada, sem token pessoal no código.

## Atualizar o MolaStruct

A primeira release pública é `v0.5.0`, criada no commit indicado no início deste documento.
O nome do binário nativo é `molasstruct`; a integração lê o Cargo e preserva esse nome, sem
renomear o executável instalado para o nome comercial.

Depois de ativar o hub, atualize seu checkout do MolaStruct e revise o conteúdo que pretende
distribuir. Para publicar a versão atual, use a tag correspondente; para uma atualização,
sincronize antes a nova versão:

```sh
cd mola-struct
git pull --ff-only
npm ci
npm run release:version -- 0.5.1
npm run check
npm run format
git diff
git add .
git commit -m "release: MolaStruct 0.5.1"
git tag -a v0.5.1 -m "MolaStruct 0.5.1"
git push
git push origin v0.5.1
```

`0.5.1` é um exemplo de próximo número, não uma release já publicada. O comando de versão
atualiza package.json, package-lock, configuração Tauri, manifesto nativo e os crates locais
que compartilham a versão atual, incluindo seus lockfiles. Ele não cria commit nem tag.

Como alternativa, depois de enviar o código revisado, execute **Actions → Publish release →
Run workflow**, na branch padrão, e informe `v0.5.1`. O workflow cria a tag no commit selecionado.

Notas podem ser preparadas em um **rascunho** de release com a mesma tag antes de disparar
o workflow. Se não houver rascunho, o publicador cria um com notas básicas. O manifesto assinado
registra essas notas no momento da publicação. Editar o texto da página depois não modifica
o catálogo assinado; inclua correções de conteúdo em uma nova versão.

Para testar manualmente uma tag existente: Actions → Publish release → Run workflow → informe
a tag. Um rascunho de uma tentativa que falhou pode ser completado pela reexecução quando os arquivos
existentes têm o mesmo SHA-256. O publicador nunca sobrescreve assets. Se você recompilar e os
bytes mudarem, remova somente o rascunho incompleto antes de repetir, ou use outra versão. Uma release
já publicada não é sobrescrita: corrija o problema e publique outro número.

## Publicar o primeiro ConsoloStruct

O repositório já recebeu código desktop na versão `0.6.0`, o comando `release:version`, o
workflow e as ferramentas de publicação. O CI usa Ubuntu 24.04, compatível com o Playwright
fixado no projeto. O teste de repouso da vista 3D aguarda o desenho da nova orientação.

Depois de concluir os ajustes e enviar o código, confira o CI e execute **Actions → Publish
release → Run workflow → tag `v0.6.0`**, na branch padrão. Não é necessário reconfigurar as
chaves nem o catálogo. Se o número do código tiver mudado, use a tag da versão efetiva.
O catálogo inclui os instaladores após os dois builds e a publicação assinada terminarem.

## Publicar e atualizar o próprio launcher

O launcher segue o mesmo comando de versão e o mesmo workflow, mas os arquivos saem no hub,
com tags `launcher-v0.2.0`, `launcher-v0.2.1` etc. Os fontes continuam com tags `v0.2.0`,
`v0.2.1` no repositório do launcher.

Após a configuração inicial, uma primeira tag `v0.2.0` pode publicar o estado desta versão.
Baixe e instale o primeiro NSIS/AppImage manualmente pelo hub. As próximas versões estáveis
aparecerão no aviso **Atualizar e reiniciar**. Instalações antigas sem a chave e o endpoint
precisam dessa primeira instalação manual. O binário precisa ter sido compilado com as
variáveis públicas de updater configuradas; o workflow faz isso.

Linux: a atualização interna do launcher atende **AppImage**. Instalação via `.deb` continua
sendo atualizada pelo gerenciador de sistema. Windows: o pacote é NSIS por usuário. Os formatos
e arquiteturas deste fluxo inicial são Windows/Linux x86_64; não anunciamos ARM sem build.

As assinaturas Tauri e Ed25519 protegem a autenticidade no fluxo de atualização. Elas são
independentes de um certificado Authenticode do Windows. Os testes dos instaladores nos dois
sistemas continuam necessários antes de anunciar uma versão estável para uso geral.

## O que o usuário vê e em quanto tempo

O launcher verifica novas versões ao abrir, aproximadamente a cada **15 minutos** enquanto
estiver aberto e ao voltar à janela/conexão (com limite de uma consulta automática por minuto).
Downloads e instalações em andamento suspendem essa consulta. Também existe a verificação manual.
Tudo isso pode ser desligado em Configurações → Verificar atualizações automaticamente.

O hub verifica as releases aproximadamente a cada 15 minutos. Com o evento opcional,
a sincronização pode começar logo depois da publicação. Sem evento, considere dois intervalos
de consulta mais os atrasos de fila/cache; não há prazo exato garantido pelo GitHub Actions.
Para antecipar, execute o workflow de catálogo e depois o botão de verificação no launcher.

O catálogo usa a URL pública:

```text
https://raw.githubusercontent.com/ricardocorsini/openstruct-catalog/<branch-do-hub>/catalog.signed.json
```

O feed de atualização do próprio launcher usa:

```text
https://raw.githubusercontent.com/ricardocorsini/openstruct-catalog/<branch-do-hub>/launcher/latest.json
```

Substitua `<branch-do-hub>` pelo nome mostrado pelo inicializador. O primeiro endpoint existe após a configuração; o segundo é criado após a primeira release estável do
launcher e a sincronização do hub. `v0.4.0-beta.1` gera um pré-lançamento de aplicativo, oferecido
somente a quem seleciona o canal beta. O updater do próprio launcher, nesta etapa, oferece
somente versões estáveis.

Em falha de rede, metadados inconsistentes ou assinatura inválida, a sincronização não publica
o novo catálogo. O launcher mantém o último catálogo verificado. Ele não instala nada sozinho.

## Conferir uma publicação

1. Na aba Actions do app, os dois builds e o job de publicação precisam estar verdes.
2. A release pública deve conter `.exe`, `.AppImage`, `SHA256SUMS.txt` e `openstruct-release.json`.
   A release do launcher inclui também os arquivos `.sig` do Tauri.
3. Na aba Actions do hub, confira Synchronize signed catalog. Se necessário:

   ```sh
   gh workflow run catalog.yml --repo ricardocorsini/openstruct-catalog
   gh run list --repo ricardocorsini/openstruct-catalog --limit 5
   ```

4. No launcher desktop, use Verificar atualizações. Uma primeira release libera **Instalar**;
   uma release maior que uma versão já instalada libera **Atualizar**.
5. Teste a instalação limpa, a abertura e uma atualização preservando um projeto existente,
   nos dois sistemas. Uma versão beta é adequada para validar esse percurso antes da estável.

GitHub pode desativar workflows agendados em repositórios públicos sem atividade por 60 dias.
Monitore a aba Actions e reative o agendamento quando necessário. O catálogo retém as 20 versões
mais recentes de cada app. Revise a política antes de ultrapassar 500 releases no mesmo repo.

## Etapas que permanecem para o mantenedor

- Preservar o backup das chaves de produção já cadastradas.
- Conferir o Secret do token limitado ao hub antes de publicar o launcher privado.
- Publicar o ConsoloStruct quando seus ajustes estiverem revisados.
- Validar instalação, abertura, remoção e preservação de projetos nos dois sistemas. Uma
  atualização entre versões reais só poderá ser testada após existir uma segunda release.

As releases publicadas são imutáveis. Alterações posteriores no código entram na próxima versão.
