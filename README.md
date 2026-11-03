# MV Imóveis

Site institucional + catálogo de imóveis + painel administrativo da MV
Imóveis (Jaboatão dos Guararapes — PE, CRECI 15063).

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Supabase
(Postgres + Auth + Storage), deploy alvo Vercel.

## Estado atual

A produção está conectada ao Supabase. Desenvolvimento usa a branch `dev`;
a produção continua vinculada à `main`. Antes de testar cadastros, configure
Supabase próprio para desenvolvimento: Preview e Development ainda estavam
usando o projeto real na verificação de 2026-10-27.

Sem variáveis configuradas, o site público funciona com catálogo vazio e
o painel pede configuração. Nunca copie automaticamente as credenciais de
produção para testes de escrita.

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

| Variável                        | Onde usar                   | Observação                                           |
| ------------------------------- | --------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Local e Vercel              | Project URL do Supabase                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local e Vercel              | Chave pública (anon), protegida por RLS              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Opcional, só scripts locais | **Nunca** commitar nem usar no client                |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`   | Local e Vercel              | Só quando o número real for confirmado (ver seção 5) |
| `NEXT_PUBLIC_SITE_URL`          | Vercel                      | URL pública do deploy, para metadados                |

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

Use Node 24 (`.nvmrc`). Os checks de qualidade são `npm run lint`, `npm test`,
`npm run typecheck` e `npm run build`. Branches de trabalho partem de `dev`;
publicação ocorre por PR para `main`, após revisão e aprovação do usuário.

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

## 8. XML do Imovelweb

O painel permite informar um preço específico para o portal e selecionar quais
imóveis entram no XML. O feed fica desativado por padrão, exige uma chave e não
altera o atendimento de leads nem os botões de WhatsApp.

Consulte [configuração, migration e testes](docs/imovelweb-xml.md) e o
[passo a passo de ativação e migração do catálogo](docs/imovelweb-implantacao.md).
O [relatório de verificação de 2026-10-31](docs/imovelweb-verificacao-2026-10-31.md)
registra os checks finais, a pendência de dependências de desenvolvimento e os
limites da validação antes da ativação no portal.
A migration nova é preparada e testada em banco isolado; não é aplicada
automaticamente em produção. A aceitação da carga ainda precisa ser homologada
pelo portal.

## Estrutura

- `app/(site)` — site público (home, catálogo, página do imóvel).
- `app/admin` — painel administrativo protegido por Supabase Auth.
- `components` — componentes de UI do site público.
- `components/admin` — componentes do painel.
- `lib` — acesso a dados (Supabase), tipos e utilitários.
- `supabase/schema.sql` — schema completo com RLS e bucket de fotos.
- `supabase/seed.sql` — dados iniciais confirmados (cidade/bairro).
- `lib/imovelweb` e `app/imovelweb/feed.xml` — validação, leitura e geração do XML.
- `tests` — testes da carga, HTTP, paginação, ambiente e validação de formulário.
- `docs/imovelweb-xml.md` — operação e limites da integração XML.
