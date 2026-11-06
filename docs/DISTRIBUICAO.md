# Preparação da distribuição

A versão 0.2 implementa a publicação por tags e a sincronização de um catálogo público assinado. A ativação da conta, chaves e primeiras releases está documentada em [RELEASES.md](RELEASES.md). Este documento complementa o roteiro com os formatos e critérios de validação.

## Produtos

1. Consolidar nome de exibição e identificadores do ConsoloStruct e MolaStruct. O repositório do segundo usa também a grafia MolasStruct; avaliar os identificadores existentes antes de renomear.
2. Gerar pacotes Windows NSIS por usuário e Linux AppImage, preservando os nomes reais dos executáveis.
3. Testar instalação, abertura, importação de projeto, atualização e desinstalação nos sistemas pretendidos.
4. Publicar arquivos de uma versão identificada, acompanhados de notas de lançamento. O ZIP de código-fonte automático do GitHub não é um instalador.
5. Gerar os assets assinados, incluí-los no catálogo e publicar o envelope somente quando os arquivos estiverem disponíveis.

GitHub Releases é a hospedagem proposta para os binários. O catálogo pode usar hospedagem estática. Para funcionar sem conta, ambos precisam estar acessíveis publicamente; não embutir credenciais de repositórios privados no aplicativo.

## Launcher

O workflow manual compila NSIS no Windows e AppImage/Debian no Linux. Os artefatos do Actions são temporários e destinados a validação. Não são a fonte pública definitiva dos downloads.

A própria atualização do launcher requer:

- Arquivos e assinaturas gerados pelo Tauri com `bundle.createUpdaterArtifacts` habilitado para a publicação.
- Chave privada Tauri guardada no ambiente de publicação e chave pública correspondente.
- Endpoint HTTPS com os metadados no formato oficial do updater.
- `STRUCT_LAUNCHER_UPDATE_URL` e `STRUCT_LAUNCHER_UPDATE_PUBKEY` definidos durante a compilação. O `build.rs` acompanha mudanças nessas variáveis.

As variáveis acima são públicas. A chave privada de assinatura Tauri é outra informação e não deve ser incluída nelas nem versionada.

Instalações Debian do launcher devem ser atualizadas pelo gerenciador de sistema. O backend desabilita o updater interno quando o formato de instalação identificado não é AppImage no Linux.

No Windows, a assinatura Tauri ou a assinatura Ed25519 dos pacotes gerenciados não substitui a assinatura de editor do instalador. A assinatura de código e os testes de reputação do Windows fazem parte da preparação da distribuição pública.

## Critérios para considerar uma versão distribuível

- Instalação limpa e abertura aprovadas por plataforma e arquitetura publicada.
- Atualização a partir da versão anterior, com projetos preservados.
- Erros de rede, assinatura e falta de espaço tratados.
- Remoção confirmada sem exclusão dos projetos.
- Catálogo coerente com os arquivos publicados e as chaves compiladas.
- Arquivos de versão já publicados não são substituídos por outros bytes com o mesmo número.

Use o inicializador e o roteiro em [RELEASES.md](RELEASES.md) para configurar a distribuição e publicar novas versões.

## ArmaduraStruct e publicador central

O fluxo `Publish ArmaduraStruct` usa o publicador deste repositório, a chave de pacotes `OPENSTRUCT_PACKAGE_KEY` e o token de distribuição já configurados. O código vem exclusivamente de `ricardocorsini/armadura-struct`, com tag e SHA completos e correspondentes. O hub permite explicitamente este publicador em `distribution.json`. Os builds não recebem a chave de pacotes nem o token de escrita. A assinatura e a publicação são feitas em outro job, executando somente tooling fixado por SHA do hub.

As releases do aplicativo ficam no hub público com prefixo `armadurastruct-v`. A assinatura de pacotes usa `launcher-packages-v1`; seu conteúdo vincula o ID de aplicativo, a versão, a plataforma e o hash, impedindo reaproveitar uma assinatura entre produtos. A chave do catálogo permanece separada. Isso conserva a compatibilidade dos Launchers já instalados, sem distribuir nova chave ou credencial ao repositório do aplicativo.

Para solicitar uma versão, prepare a tag no repositório do ArmaduraStruct e execute o workflow deste Launcher com `tag` e `commit`, ou altere `.github/armadura-release-request.json`. A publicação só é liberada após os dois builds. O ícone genérico do esquema v1 é resolvido localmente para a gravura de Hefesto por `iconPath` a partir do ID `armadurastruct`.
