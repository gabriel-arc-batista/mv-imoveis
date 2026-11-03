# Implantação do XML e migração do catálogo

O XML implementado gera uma URL com os imóveis selecionados no site. O Imovelweb
lê essa URL para criar e atualizar anúncios. Essa integração envia site → portal;
não baixa imóveis do portal nem altera a configuração de recebimento de leads.

## 1. Identificar a origem dos imóveis atuais

Perguntar ao Matheus/Nicole quem cadastrou os imóveis e em qual sistema. Conferir
na Central do Anunciante se há um integrador já ativo. O usuário informou em
2026-10-27 que ainda não sabe se existe CRM.

| Origem atual                 | Como trazer para o site                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRM/integrador               | Pedir ao fornecedor uma exportação autorizada CSV, XML ou JSON e as fotos originais. Conferir amostra e formato antes de desenvolver um importador.            |
| Cadastro direto no Imovelweb | Recadastrar no nosso painel usando as fichas, textos e fotos originais do Matheus. O suporte informou a esta conta que não oferece exportação do portal.       |
| Arquivos/planilha próprios   | Organizar e validar os dados existentes; o painel permite cadastro individual. Importação em lote depende de um formato definido e ainda não foi implementada. |

Não há importação automática pronta de CSV/CRM nesta entrega. A existência de
documentação de API não significa que a conta recebeu acesso de exportação.
Construir uma API nossa não concede esse acesso. Não automatizar coleta do portal
ou usar as imagens hospedadas nele como armazenamento permanente do site.

Criar um inventário com: código/ID atual no portal, referência interna, título,
finalidade, tipo, disponibilidade, preço, endereço/CEP, cidade/bairro, área total,
área construída/coberta confirmada, quartos, banheiros, vagas, descrição e arquivos
de fotos. Marcar cada item como conferido no site e depois conferido no portal.
Não incluir contatos de interessados nessa transferência de catálogo.

## 2. Confirmar com o Imovelweb antes de ativar

Mensagem sugerida para o atendimento oficial:

> Estamos preparando XML próprio para a conta da MV Imóveis. Precisamos manter
> o atendimento e os leads como estão. Podem confirmar o código da imobiliária e
> se precisamos cadastrar/homologar um integrador próprio? Já existem anúncios
> cadastrados: como vinculá-los ao novo XML sem duplicar ou despublicar? Qual
> identificador devemos preservar e como vocês tratam anúncios manuais, imóveis
> omitidos, carga vazia e falhas HTTP 503? Existe homologação ou piloto isolado?
> Qual é a frequência de leitura e onde consultamos erros de processamento?

Confirmar também os IDs de tipo/subtipo e as características exigidas por tipo.
Guardar a resposta como decisão da implantação.

`codigoAnuncio` é a chave estável da integração: a implementação usa o UUID do
imóvel no site. `codigoReferencia` é a referência editável da imobiliária. Copiar
a referência antiga para o site **não garante** associação ao anúncio antigo.
Não trocar UUIDs nem presumir que o portal vincula por título, endereço ou preço.
Se o suporte exigir outra chave para a migração, ajustar o mapeamento e testá-lo
antes do primeiro envio. Não desativar anúncios existentes para tentar resolver
duplicações sem o procedimento acordado.

## 3. Preparar o ambiente isolado e testar o fluxo completo

1. Usar Supabase próprio para desenvolvimento: Database, Auth e Storage separados.
2. Aplicar o schema/seed nesse ambiente novo, ou a migration revisada no banco de
   testes existente. A migration XML deste PR nunca foi aplicada em produção.
3. Configurar Preview com as chaves públicas desse projeto. Criar administradores
   de teste e testar login, cadastro, edição, upload, capa, ordem e remoção de fotos.
4. Conferir que todos os campos salvos e todas as fotos correspondem ao cadastro.
   Testar indisponibilidade, validação e exclusão sem afetar o projeto real.
5. Habilitar XML somente nesse ambiente, com chave aleatória e código reconhecido
   pelo portal. Validar GET/HEAD, token inválido, catálogo vazio e falhas parciais.
6. Conferir o XML e submetê-lo à homologação acordada. A URL de preview não deve
   ser cadastrada como fonte dos anúncios de produção.

Os testes automáticos cobrem lógica, HTTP/PostgREST simulado, PostgreSQL efêmero,
XSD oficial e formulário em Chromium com Server Action de teste. Essa evidência
não substitui os passos reais de Auth/Storage e homologação acima.

## 4. Trazer e conferir o catálogo no site

Começar com um imóvel representativo no ambiente isolado. Cadastrar o preço,
finalidade, localização e áreas corretas; enviar pelo menos cinco fotos distintas,
definir a capa e conferir a vitrine. Não preencher a área construída copiando a
total por conveniência. Para terrenos, o XML usa apenas a área total.

Depois de validar a amostra, repetir o cadastro ou preparar uma importação em
lote específica para o arquivo autorizado obtido na origem. Uma importação futura
deverá validar tudo antes da gravação, gerar relatório de pendências, evitar
duplicações e permitir execução de ensaio. A lista revisada deve ter correspondência
com o inventário dos anúncios existentes.

Manter **Incluir este imóvel no XML** desmarcado até confirmar os dados e o plano
de transição. Não selecionar uma amostra reduzida em produção antes de saber o
efeito dessa carga sobre os anúncios atuais.

## 5. Publicar a integração com autorização

Após revisão do PR para `dev`, ensaio completo e aprovação explícita de produção:

1. Ter backup verificado do banco e inventário/cópia das fotos necessárias antes
   de alterar produção. Conferir o procedimento de restauração.
2. Aplicar a migration XML revisada e publicar pelo PR de `main`, mantendo o feed
   inicialmente desativado. Não aplicar novamente o schema completo no banco real.
3. Configurar código da imobiliária, estado, chave do feed e domínio público na
   Vercel Production. Manter contatos opcionais omitidos ou iguais aos atuais,
   conforme confirmação do suporte, sem alterar Integração de Leads.
   Usar `IMOVELWEB_CODIGO_IMOBILIARIA`, `IMOVELWEB_ESTADO`,
   `IMOVELWEB_FEED_TOKEN` (aleatório, com pelo menos 32 caracteres) e
   `NEXT_PUBLIC_SITE_URL` (origem HTTPS definitiva). Manter
   `IMOVELWEB_XML_ENABLED=false` nesta etapa. Alterações nas variáveis da Vercel
   só chegam ao aplicativo em um novo deployment; fazer redeploy após configurá-las.
4. Selecionar o conjunto de anúncios definido com o suporte e corrigir as pendências
   em `/admin/imovelweb`. Habilitar `IMOVELWEB_XML_ENABLED=true`, fazer novo
   deployment e conferir GET/HEAD na URL definitiva: ambos devem responder 200
   com `Content-Type: application/xml`; GET contém o catálogo completo e HEAD
   não contém corpo. O portal precisa acessar essa URL por HTTPS usando a chave
   na query string, sem login administrativo nem bloqueio de acesso da Vercel.
   Conferir também o acesso público às fotos. Uma resposta 404/503 não é uma carga
   pronta para ativação.
5. Na Central do Anunciante: **Perfil → Imobiliária/Corretor → Integração de Anúncios
   → XML**. Informar a URL definitiva com chave e salvar, seguindo a orientação
   recebida do suporte. Não cadastrar a URL em documentação ou comentários públicos.
6. Aguardar o processamento informado pelo portal e comparar os anúncios com o
   inventário: identificadores, ausência de duplicações, fotos/capa, preço,
   finalidade, localização, áreas e disponibilidade. Conferir também os anúncios
   anteriores que deveriam permanecer ativos e o destino dos contatos.

A Central de Ajuda descreve a [habilitação da integração de anúncios](https://help.imovelweb.com.br/s/article/Como-habilitar-uma-integra%C3%A7%C3%A3o-de-an%C3%BAncios).
As regras específicas da conta e do catálogo existente precisam da confirmação
do atendimento; o XSD valida a forma do arquivo.

## 6. Operação e recuperação

Depois da transição acordada, cadastrar/atualizar no site os imóveis gerenciados
pelo XML e acompanhar o resultado no portal. Evitar edições concorrentes nos dois
sistemas sem saber qual fonte prevalece.

Se houver falha, consultar pendências no painel e categorias seguras nos logs.
A implementação bloqueia cargas parciais ou vazias com 503, mas isso não garante
como o portal preserva anúncios: seguir o procedimento combinado para interromper
a sincronização e manter o atendimento. Não enviar uma carga vazia para testar
nem apagar anúncios manuais como tentativa de recuperação.

Para retirar um imóvel, confirmar a regra de omissão/despublicação com o suporte.
Quando o último imóvel sair da carga, o endpoint retorna 503; encerrar esse último
anúncio e desativar a integração exige o procedimento confirmado pelo portal.

Referências técnicas: [runbook do código](imovelweb-xml.md) e [Open BR](https://open-classifieds.notion.site/bra).
