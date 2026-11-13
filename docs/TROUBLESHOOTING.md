# Recuperação e diagnóstico

## Aplicativos em desenvolvimento

É o estado esperado enquanto os pacotes não foram publicados no catálogo. A primeira versão inclui descrição, identidade e links dos produtos. Não há um servidor de downloads fictício.

## Catálogo não atualiza

Confira conexão, URL HTTPS, origem autorizada, chave pública configurada e assinatura do envelope. Em erro, o último catálogo verificado é mantido. Um catálogo antigo é recusado; preserve sua data de publicação crescente.

## Instalação interrompida

O launcher não retoma um arquivo parcial; use Tentar novamente para baixar o pacote completo. Se o instalador do Windows ainda estiver trabalhando, aguarde sua conclusão antes de tentar outra operação. A abertura seguinte confere o inventário e sinaliza executáveis ausentes ou alterados.

## AppImage não abre

Confira os requisitos de FUSE, WebKitGTK/glibc e os sistemas validados para o pacote. Uma distribuição mais antiga que a base de compilação pode ser incompatível. Não desative a verificação de assinatura para resolver um problema de runtime.

## Executável alterado ou ausente

Use a reinstalação de um pacote publicado para reconciliar a origem. Esta versão não adota automaticamente uma atualização feita por outro programa e não importa instalações externas.

## Estado local danificado

Feche o launcher. Localize o diretório de dados da aplicação e preserve uma cópia de `state.json` e `catalog-cache.json` antes de qualquer intervenção. Não apague pastas de projetos. O programa não sobrescreve silenciosamente um estado inválido.

Se precisar recomeçar as preferências, renomear o estado preservado permite uma nova inicialização, mas o inventário anterior deixa de ser apresentado; as pastas de instalação existentes não são importadas automaticamente. Preserve o inventário original para recuperação pelo mantenedor. Restaurar um arquivo de estado de outra máquina não transfere seus executáveis.

## Duas instâncias

Um lock protege as gravações. Feche a instância anterior. Não exclua arquivos de lock enquanto um processo estiver em execução; o lock é liberado pelo sistema quando a instância termina.

## Ícone ou atalho no Linux

Abra o AppImage do Struct Launcher 0.2.3 ou posterior uma vez. Ele cria sua entrada no menu e atualiza os atalhos dos aplicativos instalados com a arte de cada um. Veja [Instalação e menu Linux](LINUX.md).

## Imagem antiga do GeoSPT

A arte atual do GeoSPT (Atena e estaca cilíndrica sobre verde `#238A74`) está no Launcher desde a versão 0.2.5. Antes de relatar um defeito, identifique a superfície e a versão em **Configurações**:

| Onde a imagem antiga aparece                                                     | Origem                                                                                                                                                                                                                               | O que fazer                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card, lista ou detalhes do Launcher                                              | Launcher 0.2.0 a 0.2.4. O catálogo assinado oferece o GeoSPT a essas versões, que mostram o símbolo genérico OpenStruct                                                                                                              | Atualizar o Launcher para 0.2.5 ou posterior. O catálogo mantém `icon: "openstruct-mark"` por compatibilidade; a arte vem do ID `geosptstruct` e é incluída no próprio Launcher                                |
| Menu Linux: entrada `openstruct-geosptstruct`                                    | Atalho gerenciado criado por Launcher 0.2.0 a 0.2.4, com o símbolo OpenStruct                                                                                                                                                        | Abrir o Launcher 0.2.5 ou posterior uma vez. Ele cria `geosptstruct.desktop` com a arte própria e remove só o atalho antigo que ele gerencia. Favoritos fixados e cache do ambiente: veja [LINUX.md](LINUX.md) |
| Atalho criado pelo usuário ou por outro programa                                 | Fora do Launcher                                                                                                                                                                                                                     | O Launcher não altera atalhos externos. Remova-o ou use a entrada criada pelo Launcher                                                                                                                         |
| Executável, janela, barra de tarefas, Menu Iniciar e área de trabalho do Windows | Ícone do próprio pacote GeoSPT (“Geo / SPT” em fundo escuro), definido em `src-tauri/icons/` de [`itanervale/GEOSPT-STRUCT`](https://github.com/itanervale/GEOSPT-STRUCT/tree/v2.0.7/src-tauri/icons) e copiado pelo instalador NSIS | Depende de uma nova versão do GeoSPT com o ícone atualizado. O Launcher não altera binários nem atalhos criados pelo instalador do produto                                                                     |

No Linux, o atalho criado pelo Launcher usa `StartupWMClass=geosptstruct`; ambientes que associam a janela ao atalho exibem a arte do Launcher. Outros ambientes podem mostrar o ícone embutido no AppImage do GeoSPT.
