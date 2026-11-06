# Histórico de mudanças

## 0.2.0

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

A infraestrutura exige configuração inicial na conta do mantenedor. Esta entrega não gera chaves de produção nem publica releases reais.

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
