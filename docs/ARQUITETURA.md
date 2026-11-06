# Arquitetura

## Interface e núcleo

React/TypeScript apresenta o catálogo e recebe snapshots tipados. Os comandos Tauri encaminham IDs, versões e preferências ao `launcher-core`. O núcleo não depende da janela, o que permite testar transferência, assinaturas e arquivos separadamente.

Snapshots têm uma revisão crescente. A interface descarta respostas antigas, evitando substituir um evento de progresso recente por uma resposta de comando atrasada. Os recursos secundários da interface são carregados sob demanda. Fontes e imagens ficam no pacote.

## Confiança do catálogo

`catalog/bundled.json` é parte do binário. O catálogo remoto é um envelope com payload e assinatura. A validação usa chaves públicas compiladas em `catalog/trust.json`; chaves fornecidas pelo próprio catálogo não são aceitas como raiz de confiança.

O envelope é verificado antes de desserializar e aplicar os produtos. O cache é salvo somente depois da validação, e sua assinatura é verificada ao abrir o launcher. Falhas de rede mantêm o último conteúdo conhecido. Um catálogo remoto com data anterior ao já conhecido é recusado. Esta primeira versão não implementa todo o protocolo TUF nem uma infraestrutura de rotação de chaves automática.

## Limites dos comandos

O frontend não recebe permissões genéricas de shell, HTTP ou filesystem. A única permissão adicional da janela é o diálogo para escolher uma pasta. Abertura de links e pastas passa por comandos de domínio. O backend busca o pacote no catálogo em vez de aceitar uma URL arbitrária enviada pela interface.

HTTP e origens não autorizadas são recusados. Cada redirecionamento também passa pela política de transporte. Transferências e catálogos têm limites de tamanho. Downloads são gravados em arquivos temporários privados; tamanho, digest e assinatura são verificados antes da instalação.

## Estado e fila

`state.json` reúne preferências, inventário e histórico. A gravação usa arquivo temporário, sincronização e substituição atômica. Um lock impede que duas instâncias alterem o inventário ao mesmo tempo.

Uma fila sequencial evita executar instaladores simultaneamente. Guardas por aplicativo coordenam abertura, instalação e remoção. Cancelamentos usam uma flag consultada durante a transferência e no início da etapa nativa. Os estados ativos são convertidos em interrompidos ao recuperar a sessão.

A execução dos instaladores e a verificação de arquivos ocorrem fora da thread da interface. A inspeção de processos cobre os executáveis gerenciados; no Linux, verifica também o ambiente APPIMAGE de processos acessíveis ao usuário. Não se trata de um serviço privilegiado que possa inspecionar ou controlar todos os processos do sistema.

## Adaptadores

**AppImage:** validar cabeçalho e digest, copiar para arquivo temporário na raiz de destino, conferir a cópia, ajustar permissão de execução e substituir o arquivo de destino. O inventário muda depois da instalação. Versões anteriores permanecem na pasta gerenciada até a remoção do produto. Um atalho `.desktop` é criado para a versão ativa.

**NSIS:** executar o instalador com argumentos fixos, modo por usuário e a pasta gerenciada. A localização `/D` é o argumento final no formato exigido pelo NSIS. Confirmar o status e a presença do executável esperado. A remoção usa o desinstalador do próprio produto; não tenta apagar à força uma instalação do Windows.

As pastas possuem um marcador de propriedade. Pastas existentes sem esse marcador e links simbólicos em locais gerenciados são recusados. O executável registrado é validado dentro da raiz e tem seu hash conferido ao reconciliar o inventário. Uma alteração externa exige revisão/reinstalação, em vez de assumir uma versão instalada confiável.

## Atualização do launcher

O plugin updater cuida exclusivamente do Struct Launcher. URL e chave pública são opções de compilação. A integração fica indisponível enquanto essas opções não forem definidas. Essa assinatura usa o formato Tauri e é separada do protocolo Ed25519 do catálogo e dos pacotes gerenciados.

O launcher instalado por um gerenciador do sistema deve ser atualizado pelo mesmo método. A opção de atualização interna é desabilitada para esse formato no backend.
