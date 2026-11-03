# XML do Imovelweb

Esta implementação exporta imóveis selecionados no painel da MV para o Imovelweb.
O site continua como vitrine com WhatsApp. Não há importação do catálogo do portal,
webhook de leads ou CRM. A configuração de Integração de Leads do portal deve ser preservada.

## Estado de entrega e ambientes

O trabalho parte de `dev`, na branch `feat/imovelweb-xml`. A produção permanece na
`main`. Publicar código, aplicar migration e cadastrar uma URL no portal são passos
distintos: este documento não autoriza nenhum deles em produção.

Preview e Development estavam configurados com o mesmo Supabase da produção em
2026-10-27. Antes de testes com cadastros, configurar banco, Auth e Storage próprios
para desenvolvimento. A proteção em `lib/supabase/environment-guard.ts` bloqueia
login, mutações administrativas, upload de fotos e XML fora de Vercel Production
quando a URL usa o host real conhecido da MV. Essa proteção não substitui o banco
separado; se o projeto real mudar de endereço, atualizar também a identificação.

## Banco e cadastro

Para um banco novo, usar `supabase/schema.sql` e `supabase/seed.sql`. Para um banco
existente, revisar e aplicar somente
`supabase/migrations/20261027163039_add_imovelweb_xml_fields.sql` depois da migration
de venda/aluguel já existente. Não aplicar novamente o schema completo sobre um
banco em uso.

A migration adiciona `price`, `covered_area_m2` e `publish_imovelweb`; todos os imóveis existentes
ficam fora do XML. `price` é um decimal exato com restrições de valor positivo,
inteiro e máximo de R$ 999.999.999.999. O banco não arredonda o valor de entrada.
O preço não aparece na interface pública; o acesso público às tabelas segue as
políticas existentes de leitura do catálogo. Não tratar esse campo como secreto.

No cadastro:

1. Informar o preço específico do portal, em reais inteiros.
2. Marcar **Incluir este imóvel no XML do Imovelweb**.
3. Salvar, enviar as fotos e corrigir as pendências exibidas no painel.

Um imóvel pode continuar apenas na vitrine, sem preço e sem seleção para o XML.
O formulário preserva os valores quando o servidor devolve erro de validação ou
de persistência. O preço não será enviado com centavos nem arredondado silenciosamente.

## Regras da carga

A implementação segue a estrutura OpenNavent BR e o XSD oficial 1.1. Exporta somente
imóveis disponíveis e selecionados explicitamente, com:

- Identificador estável UUID em `codigoAnuncio`; o código editável fica em
  `codigoReferencia`, com até 99 caracteres.
- Tipo suportado, título entre 10 e 80 caracteres e descrição de 50 a 10.000.
- Preço inteiro positivo em BRL, com operação `VENTA` ou `ALQUILER`.
- Cidade e bairro consistentes, endereço, CEP de oito dígitos e área positiva.
- Entre cinco e cinquenta fotos em URLs HTTPS distintas. O painel atual permite
  até vinte fotos. A capa vem primeiro e as demais seguem a ordem do cadastro.

A área total (`area_m2`, `CFT100`) e a área construída/coberta confirmada
(`covered_area_m2`, `CFT101`) são medidas distintas. Para imóveis que não são
terrenos, a área construída precisa ser informada separadamente, com a medida confirmada.
Para terrenos, somente a área total é enviada. A migration deixa a nova área
nula: não copia nem presume valores dos imóveis existentes. Antes de exportar
cadastros antigos, conferir qual medida havia sido preenchida em `area_m2`.
As áreas mantêm as casas decimais e contagens iguais a zero são preservadas.
Tipo de publicação: `SIMPLE`. Os IDs de tipo/subtipo e características básicas
devem ser confirmados na homologação com o portal. Características livres do site,
como piscina e varanda, não são convertidas automaticamente em IDs do catálogo.
Não anunciar essa versão como um espelhamento integral de todas as características.

Os limites de texto são verificados por caracteres Unicode e pelo conteúdo
serializado, incluindo bloqueio de campos obrigatórios que ficariam vazios depois
da limpeza XML. URLs de fotos equivalentes não contam como imagens distintas.

O XML usa `dataModificacao` em milissegundos, UTF-8 e CDATA com tratamento de
caracteres especiais e caracteres inválidos de XML 1.0.

## Configuração de servidor

Copiar os nomes de `.env.example` para o ambiente **isolado** desejado:

| Variável                                                                          | Uso                                                                  |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `IMOVELWEB_XML_ENABLED`                                                           | `false` por padrão; `true` habilita a rota                           |
| `IMOVELWEB_FEED_TOKEN`                                                            | Chave de pelo menos 32 caracteres, gerada aleatoriamente             |
| `IMOVELWEB_CODIGO_IMOBILIARIA`                                                    | Identificação reconhecida pelo portal, a confirmar com o atendimento |
| `IMOVELWEB_ESTADO`                                                                | Nome completo do estado, padrão `Pernambuco`                         |
| `IMOVELWEB_EMAIL_CONTATO`, `IMOVELWEB_NOME_CONTATO`, `IMOVELWEB_TELEFONE_CONTATO` | Contato opcional do publicador                                       |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | Projeto isolado em desenvolvimento; projeto real somente em produção |

Gerar uma chave sem registrá-la no Git:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

O feed usa a chave pública e as políticas de leitura do catálogo; não precisa de
`service_role` nem de credenciais de API do Imovelweb. Manter as variáveis do XML
somente no servidor, sem prefixo `NEXT_PUBLIC_`.

Os campos de contato do publicador são opcionais. Para preservar o atendimento,
deixá-los omitidos ou usar os contatos atuais confirmados com o suporte. Preencher
um contato diferente envia esse valor no anúncio; não presumir que o portal irá
ignorá-lo. Isso é separado da configuração de webhook de leads.

A URL tem o formato `/imovelweb/feed.xml?token=CHAVE`. O painel protegido
`/admin/imovelweb` mostra o endereço depois de validar a configuração e o catálogo.
Preview nunca usa o domínio de produção como alternativa: sem domínio próprio,
a URL não é oferecida. Em ambientes remotos, só aceita HTTPS e rejeita credenciais
no endereço. Um bloqueio de ambiente aparece como indisponibilidade, mesmo que
a variável de habilitação esteja marcada. Não colocar essa URL
em links públicos, comentários de PR ou logs. Rotacionar a chave exige atualizar
a URL cadastrada no portal.

## Respostas HTTP e falhas

- `GET` retorna o XML; `HEAD` verifica os mesmos dados e devolve somente cabeçalhos.
- Feed desativado, chave ausente/fraca ou chave incorreta: `404`, sem consultar o banco.
- Configuração incompleta, schema ausente, erro de leitura, paginação incompleta,
  carga vazia ou imóvel selecionado incompleto: `503`, sem XML parcial.
- Sucesso: `application/xml; charset=utf-8`, `Cache-Control: no-store`, `noindex` e `nosniff`.
- A consulta percorre páginas de 250 registros, exige contagem completa e rejeita
  mudanças de contagem durante a leitura. O limite atual é 10.000 imóveis;
  contagem acima desse limite é rejeitada já na primeira página. O painel usa
  essa mesma leitura completa, incluindo os selecionados vendidos para diagnóstico.
  Erros de consulta não são apresentados como catálogo vazio ou contagem zero.

Falhas autorizadas registram o evento `imovelweb_xml_unavailable` com uma categoria
conhecida (`configuration_invalid`, `environment_blocked`, `schema_missing`,
`read_failed`, `catalog_incomplete`, `catalog_changed`, `catalog_limit`,
`catalog_timeout`, `catalog_empty`, `property_invalid`, `identifier_duplicate` ou
`unexpected`). Não registrar URL, token, conteúdo do imóvel ou mensagens brutas
vindas do banco. O painel registra falhas de leitura com o mesmo cuidado.

O endpoint não faz chamadas de publicação ao portal e não roda cron. É o Imovelweb
que consulta a URL. A frequência e o tratamento de erros HTTP devem ser confirmados
com o atendimento; o `503` não é uma garantia contratual de preservação de anúncios.

**Carga vazia é bloqueada.** Se o último imóvel for vendido, desmarcado ou removido,
o feed retorna `503`. Para encerrar o último anúncio ou desligar a integração,
combinar o procedimento com o suporte, em vez de enviar uma carga vazia acidental.

## Ativação no portal: passos ainda pendentes

Roteiro operacional e migração do catálogo: [implantação](imovelweb-implantacao.md).

1. Confirmar com Matheus o fluxo de cadastro e com o suporte a coexistência de
   anúncios manuais, vínculo de referências e efeito de omitir um imóvel da carga.
2. Confirmar o código/nome do integrador exigido, o layout aceito e a disponibilidade
   de teste/homologação. Não cadastrar o preview como fonte de produção.
3. Testar em Supabase isolado, revisar o PR para `dev` e validar o catálogo escolhido.
4. Com aprovação de produção, aplicar a migration revisada, publicar via PR para
   `main`, configurar as variáveis e habilitar a carga.
5. Validar GET/HEAD e a seleção completa antes de informar a URL em Central do
   Anunciante → Imobiliária/Corretor → Integração de Anúncios → XML.
6. Fazer um piloto autorizado e conferir os dados e anúncios existentes no portal.

Essa ativação não exige alterar a configuração de Integração de Leads.

## Verificação reproduzível

Node 24, Python 3 e Docker para o teste de migration:

```bash
npm ci
npm run lint
npm test
npm run typecheck
npm run test:migration
npm run build
npx playwright install chromium
npm run test:browser
```

O teste de migration cria e remove seu próprio PostgreSQL 17 sem publicar portas
e sem usar nenhum banco existente. Verifica preservação dos registros, RLS,
restrições de preço e criação do schema completo em outro banco vazio.

O teste de navegador compila uma aplicação Next de teste que usa o formulário
real e uma Server Action que simula rejeição, sem acessar Supabase. Confere os
valores recebidos pelo servidor, preservação dos campos após erro, seleção de
XML, troca de cidade e rejeição de preço fracionário. Requisições do navegador
para hosts externos são bloqueadas. Isso não substitui o ensaio completo com
Auth e Storage no ambiente isolado antes de produção.

Para validar o XML contra o XSD 1.1, instalar as dependências Python em um ambiente
virtual e executar:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r tests/requirements-xml.txt
npm run test:xml-schema
```

O workflow `.github/workflows/ci.yml` executa esses checks em PRs para `dev`/`main`
e pushes em `dev`, sem credenciais de produção. As Actions estão fixadas por SHA.

## Fontes e esquema

- [Estrutura oficial XML BR](https://open-classifieds.notion.site/29b35937855281e0b7dde1cc4b154a1c).
- [Exemplos oficiais por país](https://open-classifieds.notion.site/29b35937855281028f91db28d42e1229).
- [Documentação Open BR](https://open-classifieds.notion.site/bra).
- `tests/fixtures/OpenNaventAvisoBR.xsd`: cópia do anexo público **OpenNaventAvisoBR.xsd**
  da página de estrutura, obtida em 2026-10-27; autoria do fornecedor. Usada apenas
  como contrato de validação de teste, com espaços finais normalizados e sem
  mudanças nas regras do esquema.

O XSD confirma a forma do XML; a aceitação de catálogo, créditos, fotos e regras da
conta exige homologação no Imovelweb.
