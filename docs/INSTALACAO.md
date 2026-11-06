# Instalação e compilação

## Ambiente de desenvolvimento

Node.js 22.12+ (recomendado 22), npm e Rust estável. O lockfile npm e o Cargo.lock fazem parte do repositório. Use `npm ci`; não troque versões dos arquivos de lock para contornar um erro local.

### Windows

Instale os pré-requisitos oficiais do [Tauri no Windows](https://v2.tauri.app/start/prerequisites/#windows), incluindo as ferramentas C++ da Microsoft e o runtime WebView2. Use o terminal normal do usuário para `npm ci` e `npm run desktop:dev`.

`npm run desktop:build` gera um instalador NSIS em `target/release/bundle/nsis/`. O modo padrão é `currentUser`.

### Linux

Use os [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/#linux). Em Ubuntu 22.04/24.04 e sistemas compatíveis, as bibliotecas normalmente incluem:

```sh
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

Ajuste nomes e requisitos conforme sua distribuição. O workflow usa Ubuntu 22.04 como base de compilação Linux. Isso não é uma declaração de compatibilidade com todas as distribuições.

```sh
npm ci
npm run desktop:dev
npm run desktop:build
```

Os pacotes ficam em `target/release/bundle/appimage/` e `target/release/bundle/deb/`. AppImage pode exigir suporte a FUSE no sistema do usuário. Um `.deb` instala o launcher pelo gerenciador do sistema; as atualizações do próprio launcher devem respeitar esse método.

## Versão de produção sem empacotamento

```sh
npm run desktop:build -- --no-bundle
```

O executável fica em `target/release/struct-launcher` no Linux ou `target/release/struct-launcher.exe` no Windows. Ele ainda depende dos runtimes nativos do Tauri para o sistema.

## Compilação no GitHub

Em **Actions → Desktop packages → Run workflow**, a rotina manual prepara os pacotes em Windows e Linux. Os arquivos ficam como artefatos temporários por 14 dias para validação. Publicação em Releases e configuração de assinaturas para distribuição pública são etapas próprias, descritas em DISTRIBUICAO.md.

## Onde ficam os dados

O estado fica no diretório de dados da aplicação `com.openstruct.launcher` resolvido pelo Tauri. Inclui `state.json`, `catalog-cache.json`, `downloads/` e o lock de instância. A localização concreta segue o padrão do sistema.

Por padrão, os aplicativos gerenciados ficam no diretório de dados locais do usuário, em `OpenStruct/apps`. Escolher outra pasta nas configurações cria o subdiretório `OpenStructApps`. Essa escolha vale para novas instalações; atualizações mantêm a raiz registrada no inventário.

Os arquivos de projeto de ConsoloStruct e MolaStruct são responsabilidade desses aplicativos e do local escolhido pelo usuário. Não são colocados pelo launcher em suas pastas de instalação.
