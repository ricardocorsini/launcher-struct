# Segurança

Não publique em uma issue aberta informações que permitam explorar uma vulnerabilidade, credenciais ou arquivos privados. Utilize o recurso **Report a vulnerability** do GitHub, quando habilitado no repositório, para um relato privado. Se o recurso não estiver habilitado, solicite ao mantenedor um canal privado sem detalhar a exploração publicamente.

Inclua versão, plataforma, impacto e passos mínimos de reprodução com dados fictícios. A versão 0.1.x está em desenvolvimento; correções são concentradas na versão mais recente.

O launcher aceita somente pacotes assinados com chaves reconhecidas, por HTTPS e em origens autorizadas. A assinatura de um pacote confirma sua origem e integridade; a avaliação funcional do produto continua fazendo parte da publicação do mantenedor.

Mantenha as chaves privadas fora do repositório. Os arquivos `.pem`, `.key`, `.pfx` e a pasta `private-keys/` são ignorados. `catalog/trust.json` contém exclusivamente configuração pública. O vetor em `tests/fixtures/` usa uma chave conhecida de teste, sem confiança na aplicação distribuída.
