# Validação do Struct Launcher

## v0.2.1 — correção Windows e primeira release pública (06/11/2026)

O teste de sincronização usa `pathToFileURL(mockPath).href` em `node --import`. O diretório de teste contém espaços, acento e `#`, exercitando também a codificação da URL. O CI Windows agora executa os testes JavaScript antes da compilação nativa. Os 33 testes Node passaram no Windows e no Linux; o CI Windows passou também nos testes Rust e na inicialização da configuração Tauri.

A [publicação 42271311293](https://github.com/ricardocorsini/launcher-struct/actions/runs/42271311293) concluiu os builds Windows/Linux e publicou a [release 0.2.1](https://github.com/ricardocorsini/openstruct-catalog/releases/tag/launcher-v0.2.1). A fonte é o commit `61676c888b21c619343e3957e50d9a10a8f18b69`; a tag anterior permanece imutável.

Os dois downloads reais foram conferidos: tamanho, SHA-256, assinaturas Ed25519 dos pacotes e manifesto, correspondência com SHA256SUMS.txt e vínculo das URLs/assinaturas Tauri com o feed oficial. O leitor real do frontend retornou `ready` com a versão 0.2.1. No navegador, a página pública apresentou os dois botões com os endereços corretos.

A instalação gráfica em Windows e uma atualização entre duas versões públicas reais ainda precisam de validação em computadores de destino.

## v0.2.0 — publicação e detecção de versões (06/11/2026)

| Verificação                                     | Resultado           |
| ----------------------------------------------- | ------------------- |
| TypeScript e build Vite                         | Aprovados           |
| Vitest: domínio e coordenação das consultas     | 12 testes aprovados |
| Node: assinaturas, releases, catálogo e versão  | 33 testes aprovados |
| Rust: núcleo e migração para o catálogo oficial | 18 testes aprovados |
| Playwright/Chromium                             | 8 testes aprovados  |
| Clippy do núcleo com `-D warnings`              | Aprovado            |
| Prettier e rustfmt                              | Conferidos          |

O inicializador tem oito testes de regressão adicionais: hubs em `main`, `master` e branch com
barra, criação de hub, primeiro commit, metadados atrasados após renomeação, permissões,
renderização do workflow e referência do commit. A configuração preserva a branch existente
e a usa nos endpoints de catálogo e updater.

A geração de arquivos tem cinco testes adicionais: formatação para projetos com estilos
diferentes, configuração por diretório, limpeza após falha do formatter, validação da versão
do formatter e preservação de alterações concorrentes. Um teste de integração local executou
o formatter real de cada projeto (MolaStruct: Prettier 3.6.2; launcher: 3.9.10) e confirmou
que o workflow e o script gerados são idênticos aos arquivos aprovados nesses projetos.

O fluxo de solicitação de release tem seis testes: criação no commit escolhido, reexecução
sem mover tags, versão/branch incompatíveis, publicação manual, push de tag e validação SemVer.

O teste novo da interface usa uma ponte nativa substituída apenas no ambiente de teste:
confere a consulta ao abrir, o aviso de atualização de aplicativo e do launcher, a nova
consulta após 15 minutos, a navegação para a atualização disponível e a ausência de qualquer
comando de instalação automática. Também confere o layout dos avisos em tela estreita.
Esses fixtures não são incluídos no catálogo distribuído.

A integração do sincronizador executa o script real contra respostas GitHub controladas:
verifica uma publicação válida, uma segunda consulta sem alterações, falha HTTP 503 e
metadados adulterados. O catálogo anterior permanece byte a byte igual nas falhas. Os outros
testes verificam vínculo de produto/tag/arquivo, assinaturas, tamanho/digest, canal beta,
retomada de upload sem sobrescrever arquivos, coleta AppImage e sincronização dos números
em package.json, Tauri, Cargo e lockfiles.

O teste Rust de migração abre um estado de instalação antiga sem URL, aplica o novo endereço
oficial e preserva preferências e uma URL personalizada existente. Desligar a opção de
verificação automática continua sendo respeitado.

O CI nativo da versão 0.2 passou em Windows e Linux. A primeira publicação real do MolaStruct
foi concluída: [Actions 42249468813](https://github.com/ricardocorsini/mola-struct/actions/runs/42249468813).
Os builds NSIS/AppImage, os testes e a publicação passaram. A release `v0.5.0` permanece
vinculada ao commit `9cc4c390fa985ba25d34b99c912d25cb7d8dd8b9`.

Os dois instaladores publicados foram baixados; seus tamanhos e SHA-256 conferem com o
manifesto. As assinaturas Ed25519 do manifesto, dos pacotes e do catálogo público foram
verificadas com as chaves do launcher. O catálogo contém MolaStruct 0.5.0 com os dois alvos e
ConsoloStruct sem versões publicadas. As chaves privadas de produção não estão nesta sessão.

**Limites desta entrega:** o percurso de instalação e abertura gráfica dos instaladores reais
nos computadores dos usuários ainda precisa de validação. Uma atualização real entre duas
versões depende da próxima release. O registro de build desktop abaixo pertence à versão 0.1.
Os motores de cálculo dos produtos não são validados pelos testes do launcher.

## Registro da v0.1.0 — verificações executadas

| Verificação                                                      | Resultado                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| TypeScript estrito e build Vite                                  | Aprovados                                                                |
| Testes de domínio da interface                                   | 8 aprovados                                                              |
| Testes Node de assinatura e catálogo                             | 4 aprovados                                                              |
| Testes Rust do núcleo no Linux                                   | 17 aprovados                                                             |
| Teste de configuração inicial do updater Tauri                   | 1 aprovado; inicialização de configuração sem endpoint publicado         |
| Testes Playwright/Chromium da interface                          | 7 aprovados                                                              |
| Formatação Prettier e rustfmt                                    | Conferida                                                                |
| Clippy do núcleo, com warnings tratados como erro                | Aprovado                                                                 |
| Integração Tauri no Linux (`cargo check`)                        | Aprovada                                                                 |
| Build desktop Linux, debug, com assets incorporados e sem bundle | Executável gerado com `npm run desktop:build -- --debug --no-bundle`     |
| Inspeção visual                                                  | Biblioteca, detalhes de MolaStruct e configurações; temas claro e escuro |

Os testes Rust cobrem verificação de assinatura compatível com Node, adulteração de metadados, origens de download, caminhos, lock de instância, persistência, recuperação de interrupção, fila/cancelamento, transferência HTTP local com tamanho/digest, pacote corrompido e redirecionamento proibido. Os testes Linux de arquivo exercitam instalação por estágio, validação de executável, recusa de symlink/pasta alheia e remoção sem exclusão do arquivo de projeto externo.

A transferência local de teste usa bytes fictícios. O teste do adaptador AppImage verifica as operações de arquivo com um fixture, sem alegar que esse fixture seja um aplicativo de engenharia executável. A política de produção continua exigindo HTTPS, origem autorizada e assinaturas.

Os testes de navegação verificam catálogo e detalhes, ausência de instaladores fictícios, busca com acentos, filtros, grade/lista, persistência, ocultação/restauração, tema, idioma, atalho de busca, estados vazios e ausência de rolagem horizontal em 1320, 880 e 390 pixels.

As imagens em `docs/assets/` são capturas reais da interface de prévia no navegador. A indicação de prévia está visível; elas não documentam uma instalação de produto já concluída.

## Limites desta verificação

- A sessão de desenvolvimento não executou um instalador NSIS em um Windows real. O workflow de CI inclui compilação e testes nativos Windows; o workflow manual gera os instaladores para validação nessa plataforma.
- O executável Tauri foi compilado no Linux. Um teste nativo adicional desserializa a configuração real do plugin updater, incluindo o estado inicial sem endpoint de distribuição. Isso não substitui uma sessão gráfica de uso nativo, a geração/instalação do AppImage ou os testes nas distribuições que serão declaradas suportadas.
- MolaStruct 0.5.0 já tem pacotes publicados e verificados no catálogo. ConsoloStruct tem a esteira preparada e aguarda a publicação autorizada pelo mantenedor.
- O launcher 0.2.1 já tem binários e feed publicados. A atualização entre duas versões públicas e o reinício por atualização real ainda não foram exercitados.
- Os testes do launcher não validam os motores de cálculo de engenharia dos aplicativos.

## Antes de uma release pública

Validar instalação limpa, abertura, atualização da versão anterior, atalhos, remoção e preservação de projetos em Windows e em cada base Linux suportada. Testar falta de espaço, interrupção de rede, processo aberto, erro do instalador, arquivo corrompido e chave incorreta. Os arquivos disponibilizados e a fonte assinada devem corresponder ao sistema e à arquitetura declarados.

## Correção de identidade e menu Linux — 0.2.3

- TypeScript e build aprovados; 13 testes de domínio/interface e 37 testes Node de distribuição passaram.
- Os 25 testes Rust do núcleo Linux passaram, incluindo migração dos atalhos antigos, arte por produto, preservação de atalhos externos e registro do AppImage. Clippy e rustfmt aprovados.
- O teste GLib abre um executável real por `.desktop` e confere o caminho exato com espaços, acentos e caracteres reservados. `desktop-file-validate` conferiu as entradas geradas.
- O PNG do MolaStruct no menu corresponde à redução LANCZOS do original de 1254 × 1254 pixels do Drive.
- O dock ainda pode conservar favoritos e ícones em cache do ambiente gráfico.
