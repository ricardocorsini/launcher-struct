# Instalar e localizar o Struct Launcher no Linux

O download oficial é um AppImage. Ele é um programa executável e não é instalado com `apt`.

1. Guarde o AppImage em uma pasta permanente, como `~/Aplicativos/StructLauncher/`.
2. Nas propriedades do arquivo, permita a execução como programa. Pelo terminal, use `chmod +x nome-do-arquivo.AppImage`.
3. Abra o AppImage. A partir da versão 0.2.3, o launcher cria sua entrada **Struct Launcher** no menu de aplicativos do usuário, com o ícone da OpenStruct.
4. Use o menu para abrir o launcher e, se desejar, fixe essa entrada no dock/barra de tarefas.

O atalho aponta para o AppImage aberto. Mantenha esse arquivo no local escolhido. Se movê-lo, abra-o uma vez na nova pasta para atualizar o atalho. A atualização integrada substitui o AppImage no mesmo local. Nenhuma permissão de administrador é necessária para os atalhos.

## Ícones dos aplicativos

MolaStruct usa a figura da Terra sustentando uma mola e uma fundação; ConsoloStruct usa Atlas sustentando a viga; ArmaduraStruct usa Hefesto trabalhando uma gaiola de armaduras, em fundo âmbar. O símbolo da OpenStruct identifica o launcher.

Ao abrir a versão 0.2.3, as instalações verificadas recebem seus ícones e nomes próprios no menu, inclusive se foram feitas pela versão anterior. Os atalhos antigos criados pelo launcher são migrados para os identificadores nativos. Atalhos externos, executáveis modificados e projetos do usuário não são substituídos.

A versão 0.2.4 inclui o ArmaduraStruct nesse mesmo fluxo, com migração de seu atalho genérico para `armadurastruct.desktop`.

Se um ícone antigo estiver fixado no dock, remova-o dos favoritos e fixe a nova entrada encontrada no menu. O ambiente gráfico pode manter o ícone anterior em cache até encerrar a sessão e entrar novamente.

## Locais usados

O launcher respeita `XDG_DATA_HOME`; no padrão Linux, utiliza:

- `~/.local/share/applications/com.openstruct.launcher.desktop`: entrada do launcher.
- `~/.local/share/icons/hicolor/256x256/apps/com.openstruct.launcher.png`: ícone do launcher.
- `~/.local/share/applications/molasstruct.desktop`: entrada do MolaStruct.
- `~/.local/share/applications/consolostruct.desktop`: entrada do ConsoloStruct.
- `~/.local/share/applications/armadurastruct.desktop`: entrada do ArmaduraStruct.
- `~/.local/share/applications/geosptstruct.desktop`: entrada do GeoSPT.
- `icon.png` dentro da pasta gerenciada de cada aplicativo: sua arte oficial.

A criação do menu é feita na inicialização nativa do AppImage. Execuções de desenvolvimento e pacotes do sistema não criam uma entrada de AppImage para o launcher. Falhas na escrita dos atalhos aparecem nos avisos e não impedem sua abertura.

## Identidade do GeoSPT

O GeoSPT usa a arte de Atena e estaca cilíndrica, fornecida na identidade visual do app. O menu nativo cria `geosptstruct.desktop`, com `StartupWMClass=geosptstruct` e PNG próprio de 256 pixels. Ao iniciar esta versão do Launcher, atalhos gerenciados anteriores são migrados sem alterar o AppImage instalado; atalhos externos são preservados. A arte da biblioteca é resolvida pelo ID `geosptstruct`, mantendo `openstruct-mark` no esquema do catálogo para compatibilidade com versões anteriores.

Launchers 0.2.0 a 0.2.4 também recebem o GeoSPT do catálogo, mas mostram o símbolo genérico e criam `openstruct-geosptstruct.desktop` com o símbolo OpenStruct; a correção é atualizar o Launcher. O ícone do executável e da janela vem do pacote do próprio GeoSPT, mantido em `itanervale/GEOSPT-STRUCT`. Veja [Imagem antiga do GeoSPT](TROUBLESHOOTING.md#imagem-antiga-do-geospt).
