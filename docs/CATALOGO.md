# Contrato do catálogo e assinaturas

## Catálogo v1

O documento possui `schemaVersion: 1`, `publishedAt` em RFC 3339 e `apps`. Os dois produtos incluídos são um exemplo real de conteúdo ainda sem pacotes publicados. Não invente uma release para habilitar um botão.

Cada produto possui ID estável, nome, resumo, descrição, área, cor, ID de ícone incluído, links HTTPS, recursos, requisitos, aviso e `releases`. IDs aceitam letras minúsculas ASCII, números e hífens, começando por letra. O nome de exibição pode mudar sem trocar o ID.

Uma release possui `version` em SemVer, `channel` (`stable` ou `beta`), `publishedAt`, `notes` em texto simples e `assets`. As notas não executam HTML ou Markdown remoto.

Cada pacote inclui:

| Campo                | Formato                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `platform`           | `linux` ou `windows`                                                   |
| `arch`               | `x86_64` ou `aarch64`; só publicar os realmente compilados e validados |
| `kind`               | `appimage` no Linux ou `nsis` no Windows                               |
| `url`                | HTTPS em uma origem autorizada, com a versão identificada no caminho   |
| `size`               | Inteiro em bytes, entre 1 e 2 GiB                                      |
| `sha256`             | 64 caracteres hexadecimais minúsculos                                  |
| `signature`          | Assinatura Ed25519 de 64 bytes, codificada em Base64 padrão            |
| `keyId`              | ID de uma chave pública conhecida pelo launcher                        |
| `minLauncherVersion` | SemVer mínima                                                          |
| `executable`         | Caminho relativo do `.exe` criado pelo NSIS; `null` para AppImage      |

Não publicar dois pacotes da mesma plataforma e arquitetura em uma versão. Uma release estável não aceita SemVer de pré-lançamento. Não incluir comandos de shell ou parâmetros livres de instalação.

## Chaves

`catalog/trust.json` define o endereço inicial opcional, as origens autorizadas e um mapa de chaves públicas. O mapa começa vazio de propósito: nenhuma chave privada foi criada ou publicada nesta entrega.

```sh
npm run keys:generate -- private-keys/catalog catalog-2026
npm run keys:generate -- private-keys/packages packages-2026
```

Os comandos criam um `private.pem` Ed25519 PKCS#8 e um `public.json` contendo os 32 bytes da chave pública em Base64. Inclua somente o valor público no mapa `keys`. Armazene as chaves privadas com segurança fora do repositório. A mudança das raízes de confiança exige distribuir uma nova versão do launcher, antes de retirar uma chave anterior em uso.

## Assinar um pacote

Crie um arquivo de metadados com `appId`, `version`, `platform`, `arch`, `kind`, `url`, `keyId`, `minLauncherVersion` e `executable`. Use o nome real do executável de cada produto.

```sh
npm run package:sign -- caminho/pacote.AppImage metadata.json private-keys/packages/private.pem asset.json
```

O comando mede e calcula o hash do pacote; assina os campos e gera um asset para incluir na release do catálogo. O arquivo de saída não é sobrescrito silenciosamente. Valide o catálogo completo antes de publicá-lo.

O texto assinado é UTF-8, sem quebra de linha final:

```text
OPENSTRUCT-PACKAGE-V1
<appId>
<version>
<platform>
<arch>
<kind>
<size decimal>
<sha256 minúsculo>
<executable ou string vazia>
```

Essa vinculação impede reutilizar a assinatura em outro aplicativo, versão, arquitetura ou caminho de executável. O SHA-256 é calculado sobre os bytes completos do pacote, sem carregar todo o instalador na memória.

## Assinar o catálogo

```sh
npm run catalog:validate -- caminho/catalog.json
npm run catalog:sign -- caminho/catalog.json private-keys/catalog/private.pem catalog-2026 catalog.signed.json
```

O envelope resultante tem `payload` (string com o JSON), `signature` e `keyId`. A assinatura cobre os bytes UTF-8 exatos de `payload`; não é necessário canonicalizar um objeto JSON em linguagens diferentes. Depois de assinar, não reformate o conteúdo dentro da string.

Hospede o envelope por HTTPS em uma origem já autorizada. Configure esse endereço na compilação ou em Configurações → Avançadas. Um endereço sozinho não acrescenta uma chave confiável nem autoriza novos hosts.

`tests/fixtures/signature-vector.json` é um vetor fictício assinado com uma chave conhecida de teste para verificar paridade entre Node e Rust. Não é um catálogo de produção e sua chave não está em `catalog/trust.json`.

## Formato do atualizador Tauri

O atualizador do próprio launcher usa o protocolo e as assinaturas do Tauri. Seu `latest.json` é um documento diferente deste catálogo. Assinaturas Ed25519 geradas pelos scripts acima não substituem os `.sig` do Tauri, nem uma assinatura Authenticode de editor no Windows.
