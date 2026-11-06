# Histórico de mudanças

## 0.2.1

- Corrige o teste de sincronização do catálogo no Windows: o módulo de preparação passado a `node --import` usa uma URL `file://`, com codificação de espaços, acentos e `#`.
- Inclui os testes JavaScript no CI Windows antes da compilação nativa, além dos checks executados durante a publicação.
- Primeira release pública do launcher: `0.2.1`, com instaladores NSIS/AppImage, manifesto assinado, SHA-256 e feed oficial. A tag `v0.2.0` da tentativa anterior foi preservada.

## 0.2.0

- Publicação por solicitação versionada ou execução manual no GitHub, com criação segura da tag e comparação das versões do frontend, Tauri e Cargo.
- Integração de release preparada no ConsoloStruct 0.6.0, junto ao MolaStruct 0.5.0.
- Primeira publicação real do MolaStruct 0.5.0: instaladores Windows/Linux e catálogo assinado conferidos.
- Correção da configuração de produtos: arquivos gerados passam pelo Prettier fixado no lockfile e pelas regras do repositório de destino antes do commit. A leitura dos arquivos é vinculada a um commit para preservar alterações concorrentes.

- Correção do inicializador: preserva a branch padrão do hub e usa seu nome nos endpoints e workflows. Remove a dependência de renomeação assíncrona de `master` para `main`.

- Infraestrutura GitHub Releases: hub público separado, workflows reutilizáveis e configuração pelo GitHub CLI.
- Builds NSIS/AppImage e publicação conjunta após validação dos dois sistemas.
- Metadados de release assinados, SHA-256 e vínculo entre produto, tag e arquivos publicados.
- Sincronização do catálogo por evento, agendamento e execução manual, preservando o último catálogo válido em falhas.
- Feed estável e assinatura Tauri separados para atualização do próprio launcher.
- Verificações automáticas ao abrir, a cada 15 minutos e ao voltar à janela/conexão, com agrupamento de requisições.
- Avisos de novas versões e migração das instalações antigas para o catálogo oficial configurado.
- Comando para sincronizar versões em package.json, Tauri, Cargo e lockfiles.
- Testes de integração do publicador de catálogo e documentação de ativação.

A configuração de produção foi ativada pelo mantenedor. O código guarda somente as chaves públicas. A primeira release dos binários do próprio launcher continua separada das releases dos aplicativos.

## 0.1.0

- Primeira implementação do Struct Launcher para Windows e Linux.
- Biblioteca OpenStruct com ConsoloStruct e MolaStruct, grade/lista, busca, filtros e detalhes.
- Preferências, temas, idioma e aplicativos ocultos.
- Catálogo assinado, cache verificado, seleção por plataforma e assinatura de pacotes.
- Fila, progresso, cancelamento, histórico e recuperação de operações interrompidas.
- Adaptadores NSIS/AppImage, inventário, abertura e desinstalação.
- Integração opcional de atualização do launcher pelo Tauri.
- Testes do núcleo, assinatura entre linguagens, domínio e navegação; CI e workflow de compilação desktop.

Esta versão não publica os instaladores dos produtos nem configura os endpoints de distribuição.
