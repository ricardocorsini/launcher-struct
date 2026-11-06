# Guia de uso

## Biblioteca

Use **Todos os aplicativos** para explorar o catálogo. Busque por nome, área ou descrição; a busca ignora acentos. Escolha uma área e uma ordenação. Grade e lista são duas formas de apresentar os mesmos aplicativos; a preferência de visualização é mantida localmente.

O nome, o ícone e **Conhecer aplicativo** abrem o painel do produto. Há descrição, recursos, requisitos, documentação e versões. Os links externos são abertos no navegador padrão.

Nesta primeira entrega, os produtos aparecem em desenvolvimento porque seus instaladores ainda serão publicados. Essa situação é diferente de um aplicativo já instalado ou de um pacote incompatível com seu sistema.

## Instalar e abrir

Quando houver um pacote assinado e compatível, use **Instalar**. Acompanhe o progresso em **Downloads**. O arquivo é conferido antes da execução. Somente após a instalação confirmada o aplicativo entra no inventário.

Use **Abrir aplicativo** na biblioteca ou o atalho criado. O launcher não precisa continuar aberto para manter o produto em execução.

## Atualizar

Use o botão de verificação ou a página **Atualizações**. A instalação é iniciada pelo usuário; a consulta automática ao catálogo não autoriza instalação silenciosa em segundo plano.

Feche o produto antes de atualizar. O launcher verifica processos conhecidos e não encerra o trabalho do usuário à força. Se um aplicativo for aberto durante o download, a etapa de instalação é recusada e pode ser tentada novamente depois de fechado.

Em **Escolher versão**, pode haver versões anteriores. Confirme o aviso antes de instalar uma versão menor. Reverter o programa não reverte o formato de um projeto já salvo: preserve cópias dos arquivos antes de abri-los em versões diferentes.

## Downloads

Estados: na fila, baixando, verificando, instalando, concluído, falhou, cancelado e interrompido. É possível cancelar antes de iniciar o instalador. A etapa nativa de instalação não é cancelada à força.

**Tentar novamente** inicia outra transferência completa. Esta versão não implementa retomada HTTP por intervalos. Arquivos temporários são descartados; um download interrompido não é marcado como instalação concluída. O histórico pode ser limpo sem interromper operações ativas.

Ao fechar o launcher com downloads ativos, há confirmação. Durante uma instalação nativa, aguarde a conclusão antes de sair. Se o processo for encerrado externamente, as operações ativas reaparecem como interrompidas na próxima abertura.

## Remover e organizar

No menu de cada produto, abra a pasta gerenciada, consulte versões, oculte o cartão ou desinstale. A desinstalação exige confirmação e preserva os arquivos de projeto guardados fora da instalação.

Aplicativos ocultos podem ser restaurados em **Configurações → Aplicativos ocultos**. Tema, idioma, canal e política de consulta ficam nessa mesma página. Clique em **Salvar configurações** para aplicar as mudanças.

O idioma altera os textos da interface. A descrição dos produtos vem do catálogo e, nesta versão, está em português. Mensagens detalhadas do núcleo nativo também podem estar em português.

## Sem internet

É possível abrir os produtos instalados e consultar o último catálogo verificado salvo. Novas instalações e a consulta de versões precisam de conexão. Esta versão não importa pacotes locais manualmente.

## Atalhos e acessibilidade

- `Ctrl+K` ou `Command+K`: abre o catálogo e leva o foco à busca.
- `Esc`: fecha painéis de detalhes e confirmações; menus de opções também podem ser fechados com Esc.
- `Tab`: navega pelos controles; os painéis modais mantêm o foco dentro deles.
- Setas esquerda/direita: alternam as abas do painel do produto.

O tema do sistema acompanha a preferência do sistema operacional. Movimentos reduzidos são respeitados.
