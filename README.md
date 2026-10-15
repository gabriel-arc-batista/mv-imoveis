# MV Imóveis

Site institucional + catálogo de imóveis + painel administrativo da MV
Imóveis (Jaboatão dos Guararapes — PE, CRECI 15063).

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Supabase
(Postgres + Auth + Storage), deploy alvo Vercel.

## Estado atual

Este projeto ainda **não está conectado a um Supabase real**. Sem as
variáveis de ambiente configuradas, o site público funciona normalmente
com o catálogo vazio, e o painel `/admin` mostra uma tela pedindo a
configuração. Siga os passos abaixo para ativar tudo.

## 1. Criar o projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (gratuito).
2. Em **Project Settings > API**, copie a **Project URL** e a **anon
   public key**.
3. Em **SQL Editor**, rode o conteúdo de `supabase/schema.sql` (cria
   tabelas, RLS e o bucket de fotos) e depois `supabase/seed.sql` (cria a
   cidade e o bairro já confirmados: Jaboatão dos Guararapes / Piedade).

Se o projeto já existia antes da separação entre imóveis para venda e
aluguel, rode também `supabase/migrations/20260902_add_property_transaction.sql`.
Os imóveis que já estavam cadastrados serão mantidos e classificados como
disponíveis para venda.

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde usar | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local e Vercel | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local e Vercel | Chave pública (anon), protegida por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional, só scripts locais | **Nunca** commitar nem usar no client |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Local e Vercel | Só quando o número real for confirmado (ver seção 5) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | URL pública do deploy, para metadados |

## 3. Criar o primeiro administrador

O cadastro de admin não fica exposto em nenhuma tela pública — é feito
manualmente uma vez:

1. No painel do Supabase, vá em **Authentication > Users > Add user** e
   crie o usuário com o e-mail e senha do Matheus.
2. No **SQL Editor**, rode (trocando o e-mail):

   ```sql
   insert into public.admins (id, email)
   select id, email from auth.users where email = 'email-do-matheus@exemplo.com';
   ```

3. Acesse `/admin/login` com esse e-mail e senha.

Novos administradores no futuro seguem o mesmo processo (criar o usuário
no Supabase Auth e inserir a linha em `admins`).

## 4. Rodando localmente

```bash
npm install
npm run dev
```

## 5. Ativando o WhatsApp

Enquanto `NEXT_PUBLIC_WHATSAPP_NUMBER` não estiver configurado, os botões
de WhatsApp do site levam para a seção de contato em vez de abrir uma
conversa — isso é intencional: evita apontar para um número provisório.
Assim que o número real da MV Imóveis for confirmado, defina a variável
no formato internacional sem símbolos (ex: `5581999999999`).

## 6. Vídeo do hero

A seção inicial (`components/Hero.tsx`) está preparada para tocar um
vídeo em loop de fundo a partir de `public/videos/hero.mp4`. Sem esse
arquivo, ela usa um fundo em degradê como alternativa — sem quebrar o
layout. Basta adicionar o vídeo (idealmente um imóvel em destaque, sem
áudio, poucos segundos) nesse caminho para ativá-lo.

## 7. Deploy na Vercel

1. Importe o repositório na Vercel.
2. Configure as variáveis de ambiente da seção 2 no projeto da Vercel.
3. O deploy de preview fica automaticamente **não indexado**
   (`app/robots.ts` bloqueia todo o crawling). Quando o site for
   autorizado para produção, ajuste `app/robots.ts` e o `robots` em
   `app/layout.tsx` para permitir indexação.

## 8. Integração com o Imovelweb

Funciona nos dois sentidos, pela API OpenNavent do Imovelweb
([documentação oficial](https://open-classifieds.notion.site/bra)):

- **Site → Imovelweb:** imóvel cadastrado no painel com **Preço** e
  **Publicar no Imovelweb** marcado vira anúncio no Imovelweb. Alterações,
  fotos, "vendido" e exclusão são repassadas. O preço não aparece no site.
- **Imovelweb → site:** anúncio cadastrado direto no Imovelweb aparece no site,
  com fotos copiadas para o Supabase. Se sair do ar no Imovelweb, some do site.
  Esses imóveis são editados no Imovelweb; no painel, só destaque e status.

Cada anúncio pertence a um lado só (coluna `source`), então um lado nunca
sobrescreve o outro.

Quando sincroniza: ao salvar um imóvel ou mexer nas fotos (envio imediato),
todo dia às 6h (Vercel Cron, `vercel.json`) e pelo botão **Sincronizar agora**
em `/admin/imovelweb`.

Entram no Imovelweb só os imóveis marcados, disponíveis, com preço,
descrição, ao menos uma foto e tipo diferente de "Outro". O painel mostra o
que falta em cada um e as recusas do Imovelweb. Exemplo: plano sem anúncios
disponíveis (cada anúncio publicado pelo site ocupa um anúncio do plano).

### Ativação

1. Rode `supabase/migrations/20261015_add_imovelweb_fields.sql` no SQL Editor
   **antes** de publicar esta versão.
2. Peça ao Imovelweb (integracao@imovelweb.com.br) credenciais de API com
   permissão de **escrita e leitura** (a leitura completa dos anúncios exige
   essa permissão), primeiro no sandbox e depois em produção. Eles informam
   `client_id`, `client_secret` e o nome do integrador.
3. Configure na Vercel: `IMOVELWEB_CLIENT_ID`, `IMOVELWEB_CLIENT_SECRET`,
   `IMOVELWEB_INTEGRADOR`, `IMOVELWEB_CODIGO_IMOBILIARIA` (ex.: `mv-imoveis`),
   `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`. Para testar no sandbox,
   `IMOVELWEB_API_URL=https://api-br-sandbox-open.navent.com`.
4. Em `/admin/imovelweb`, use o botão de vínculo com o usuário administrador
   do Imovelweb e depois **Sincronizar agora**.

### Alternativa: só feed XML

Se o Imovelweb liberar só XML, configure `IMOVELWEB_CODIGO_IMOBILIARIA` e
`IMOVELWEB_FEED_TOKEN` (sem as credenciais de API) e informe a eles a URL
`https://<domínio>/imovelweb/feed.xml?token=<IMOVELWEB_FEED_TOKEN>`. Nesse modo
o site só publica, não importa. Com credenciais de API o feed se desliga,
porque o XML tira do ar todo anúncio que não está no arquivo, inclusive os
importados. Se o banco falhar ou nenhum imóvel estiver pronto, o feed
responde 503 em vez de um arquivo vazio.

### Arquivos

- `lib/imovelweb/mapping.ts`: conversão entre imóvel e anúncio (IDs de tipo e
  características do catálogo OpenNavent Brasil).
- `lib/imovelweb/client.ts`: cliente da API.
- `lib/imovelweb/sync.ts`: sincronização nos dois sentidos.
- `lib/imovelweb/feed.ts` e `app/imovelweb/feed.xml/route.ts`: feed XML.
- `app/api/imovelweb/sync/route.ts`: rota do Vercel Cron.

## Estrutura

- `app/(site)` — site público (home, catálogo, página do imóvel).
- `app/admin` — painel administrativo protegido por Supabase Auth.
- `components` — componentes de UI do site público.
- `components/admin` — componentes do painel.
- `lib` — acesso a dados (Supabase), tipos e utilitários.
- `supabase/schema.sql` — schema completo com RLS e bucket de fotos.
- `supabase/seed.sql` — dados iniciais confirmados (cidade/bairro).
