# Contribuir

Descreva em uma issue o problema, o sistema operacional, a versão do launcher e os passos para reproduzir. Para mudanças de comportamento, inclua testes que verifiquem o resultado observável.

Antes de enviar uma pull request, execute os comandos de verificação do README. Mudanças de catálogo ou distribuição devem passar tanto pelo validador Node quanto pelos testes Rust. Alterações no protocolo de assinatura exigem atualizar a documentação e o vetor compartilhado de teste; não altere um protocolo publicado silenciosamente.

Mantenha alterações de interface separadas de permissões nativas. Comandos Tauri recebem identificadores e escolhas de produto, não comandos de shell. Não acrescente exceções de HTTP ou desative assinaturas para facilitar uma demonstração.

Use somente dados fictícios nos exemplos. Nunca inclua chaves privadas, tokens, credenciais ou arquivos de engenharia de clientes. As chaves públicas dos fixtures são exclusivamente de teste e não devem entrar no arquivo de confiança do produto.
