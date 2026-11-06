# Validação da primeira implementação

## Verificações executadas

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
- ConsoloStruct e MolaStruct ainda não têm pacotes publicados no catálogo desta entrega. Instalar e atualizar esses produtos reais de ponta a ponta depende da publicação e assinatura posterior desses pacotes.
- A atualização assinada do próprio launcher depende de chave e endpoint ainda não configurados; nenhum reinício por atualização real foi executado.
- Os testes do launcher não validam os motores de cálculo de engenharia dos aplicativos.

## Antes de uma release pública

Validar instalação limpa, abertura, atualização da versão anterior, atalhos, remoção e preservação de projetos em Windows e em cada base Linux suportada. Testar falta de espaço, interrupção de rede, processo aberto, erro do instalador, arquivo corrompido e chave incorreta. Os arquivos disponibilizados e a fonte assinada devem corresponder ao sistema e à arquitetura declarados.
