# Verificação final do XML — 2026-10-31

Repositório pessoal: `gabriel-arc-batista/mv-imoveis`. Código revisado:
`2570f3307d19c298e65a5fd0c47e4bed2d740419`, branch `feat/imovelweb-xml`,
[PR #2 para dev](https://github.com/gabriel-arc-batista/mv-imoveis/pull/2).
Esta revisão acrescenta documentação; não altera a implementação do XML.

## Resultado local

| Verificação | Resultado |
| --- | --- |
| ESLint | Aprovado |
| Testes de lógica, HTTP, configuração, ambiente, paginação e formulário | 33 aprovados |
| TypeScript e geração de tipos do Next | Aprovados |
| Build de produção Next.js 16.4.3 / Node 24.21.0 | Aprovado |
| Formulário no Chromium, com Server Action de teste | 1 teste aprovado |
| XML sintético validado no XSD OpenNavent BR 1.1 versionado | Aprovado |
| Migration e schema em PostgreSQL 17 efêmero | Aprovados; dados/RLS preservados |
| Rota HTTP no build real, com feed desativado | GET/HEAD 404, HEAD sem corpo, no-store/noindex; POST 405 |
| Auditoria das dependências de produção (`npm audit --omit=dev`) | Nenhuma vulnerabilidade reportada |
| Auditoria completa (`npm audit --audit-level=high`) | Exit 0; 16 ocorrências moderadas, nenhuma alta/crítica |
| `git diff --check` | Aprovado |

O Python local não tinha `ensurepip`/`xmlschema`. A validação XSD foi executada
em contêiner Python 3.12 descartável, instalando as versões fixadas em
`tests/requirements-xml.txt`, com o repositório montado somente para leitura.
O PostgreSQL de teste também foi descartável, sem conexão ao Supabase real.

## Pendência de dependências de desenvolvimento

O alerta [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
atinge `minimatch` e aparece em 16 entradas da cadeia de ferramentas ESLint e
TypeScript ESLint. A auditoria marca versões anteriores à 11.0.1. A sugestão
automática do npm rebaixa ESLint para 4.0.0; não foi aplicada. Também não foi
forçada uma troca de versão principal nas dependências transitivas, pois os
consumidores atuais usam contratos de versões diferentes.

Essa pendência permanece registrada para atualização compatível das ferramentas.
O resultado sem vulnerabilidades de 2026-10-28 é histórico; a auditoria completa
atual tem os alertas moderados descritos acima.

## Escopo e limites da revisão

Conferidos: separação entre consulta/validação/XML/HTTP; autorização antes de
mostrar a URL no painel; token e feature flag; configuração compartilhada;
serialização Unicode/CDATA; seleção explícita; identificadores estáveis; áreas
independentes; paginação completa e bloqueio de falhas/cargas vazias ou parciais.
Nenhuma falha funcional nova foi identificada no módulo XML.

Os testes não comprovam a aceitação pelo Imovelweb nem o fluxo real completo de
Auth/Storage. Antes de produção, continuam necessários Supabase isolado, ensaio
de cadastro/fotos e confirmação da conta, tipos de imóvel, vínculo dos anúncios
atuais, omissões da carga e comportamento do portal diante de falhas.

Nenhuma migration remota, seleção de imóvel real, alteração de leads, merge em
`main` ou ativação no Imovelweb foi executada nesta revisão.

Ativação e migração do catálogo: [roteiro operacional](imovelweb-implantacao.md).
