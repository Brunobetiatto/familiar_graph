# Familiar Graph

Familiar Graph é uma plataforma web para visualizar e expandir um grafo global de pessoas e relações. A proposta vai além de uma árvore genealógica tradicional: o sistema permite mapear conexões familiares, sociais, profissionais e acadêmicas em uma visualização interativa.

O projeto possui cadastro/login, visualização do grafo global, solicitação colaborativa de novos nós e um painel administrativo para aprovar, rejeitar ou criar nós diretamente.

## Principais recursos

- Landing page institucional com apresentação do produto.
- Autenticação simples por e-mail e senha.
- Grafo global interativo com React Flow.
- Layout automático de nós e conexões usando ELK.
- Painel lateral com detalhes do nó selecionado.
- Solicitação de novos nós por usuários autenticados.
- Suporte a múltiplas conexões em uma mesma solicitação.
- Painel administrativo para revisar solicitações pendentes.
- Criação direta de nós pelo administrador.
- Persistência em PostgreSQL via Prisma.

## Stack

- **Next.js 16** com App Router.
- **React 19**.
- **TypeScript**.
- **Prisma 7** com `@prisma/adapter-pg`.
- **PostgreSQL**.
- **React Flow** para renderização do grafo.
- **ELK.js** para cálculo de layout.
- **bcryptjs** para hash de senhas.
- **ESLint** para análise estática.

## Estrutura do projeto

```text
app/
  page.tsx                         # Landing page
  login/page.tsx                   # Login e cadastro
  global-graph/page.tsx            # Página do grafo global
  admin/page.tsx                   # Painel administrativo
  api/                             # Rotas HTTP da aplicação
  components/graph/                # Componentes do grafo, modais e painel lateral

lib/
  prisma.ts                        # Cliente Prisma com adapter PostgreSQL
  graph-layout.ts                  # Cálculo de layout do grafo

prisma/
  schema.prisma                    # Modelos, enums e relações do banco
  migrations/                      # Migrações versionadas

docker-compose.yml                 # PostgreSQL local
package.json                       # Scripts e dependências
```

## Pré-requisitos

- Node.js compatível com Next.js 16.
- npm.
- Docker e Docker Compose, caso queira subir o PostgreSQL localmente.

## Configuração do ambiente

Crie um arquivo `.env` na raiz do projeto com a URL do banco:

```env
DATABASE_URL="postgresql://Brunobetiatto:Brunobetiatto1@localhost:5432/graphdb"
```

Essa URL corresponde ao serviço PostgreSQL definido em `docker-compose.yml`.

## Como rodar localmente

Instale as dependências:

```bash
npm install
```

Suba o banco PostgreSQL:

```bash
docker compose up -d
```

Execute as migrações do Prisma:

```bash
npx prisma migrate dev
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Scripts disponíveis

```bash
npm run dev      # Inicia o servidor de desenvolvimento
npm run build    # Gera a build de produção
npm run start    # Inicia a aplicação após o build
npm run lint     # Executa o ESLint
```

## Fluxo de uso

1. O visitante acessa a landing page em `/`.
2. O usuário cria uma conta ou faz login em `/login`.
3. Após login, ele é redirecionado para `/global-graph`.
4. No grafo global, o usuário pode abrir detalhes de uma pessoa e solicitar a criação de um novo nó conectado a ela.
5. A solicitação fica pendente até ser revisada por um administrador.
6. O administrador acessa `/admin`, aprova ou rejeita solicitações e também pode criar nós diretamente.
7. Solicitações aprovadas entram no grafo global como registros oficiais.

## Autenticação e permissões

A autenticação atual é simples e provisória:

- O registro cria usuários com `role` padrão `USER`.
- O login valida a senha com `bcryptjs`.
- A sessão é controlada por um cookie HTTP-only chamado `provisional_user_id`.
- Rotas administrativas verificam se o usuário autenticado possui `role = ADMIN`.

Para transformar um usuário em administrador no ambiente local, atualize o campo `role` no banco para `ADMIN`. Isso pode ser feito via Prisma Studio ou diretamente no PostgreSQL.

Exemplo com Prisma Studio:

```bash
npx prisma studio
```

Depois abra a tabela `USER` e altere o papel do usuário desejado.

## Modelo de dados

O banco é modelado em torno de usuários, nós, arestas e solicitações.

### Entidades principais

- `User`: usuário do sistema, com e-mail, senha criptografada e papel (`USER` ou `ADMIN`).
- `GlobalNode`: pessoa oficial dentro do grafo global.
- `GlobalEdge`: relação oficial entre dois nós globais.
- `NodeRequest`: solicitação feita por usuário para adicionar uma nova pessoa.
- `NodeRequestConn`: conexões desejadas entre a pessoa solicitada e nós globais existentes.
- `PersonTree`, `PersonNode` e `PersonEdge`: estrutura para árvores pessoais, já modelada no banco.

### Tipos de relação

O enum `RelationType` contempla relações familiares, sociais, profissionais e acadêmicas:

- `PARENT`
- `CHILD`
- `SPOUSE`
- `SIBLING`
- `FRIEND`
- `ACQUAINTANCE`
- `ROMANTIC`
- `COLLEAGUE`
- `TEAMMATE`
- `MENTOR`
- `STUDENT`
- `PARTNER`
- `OTHER`

## Rotas principais

### Páginas

- `/`: apresentação do Familiar Graph.
- `/login`: login e cadastro de usuários.
- `/global-graph`: visualização interativa do grafo global.
- `/admin`: painel de revisão administrativa.

### API

- `POST /api/auth/register`: cria uma nova conta.
- `POST /api/auth/login`: autentica o usuário e cria o cookie de sessão.
- `GET /api/global-graph`: retorna nós e arestas formatados para o React Flow.
- `POST /api/global-graph`: cria nó ou aresta global.
- `GET /api/nodes/search`: busca nós globais para conexão.
- `POST /api/node-requests`: cria uma solicitação de novo nó.
- `GET /api/node-requests`: lista solicitações pendentes para administradores.
- `POST /api/node-requests/approve`: aprova uma solicitação e insere o nó no grafo.
- `POST /api/node-requests/reject`: rejeita uma solicitação.
- `POST /api/admin/nodes`: cria um nó diretamente como administrador.
- `POST /api/admin/nodes/bulk`: cria nós em lote como administrador.
- `GET /api/admin/nodes/search`: busca nós globais em contexto administrativo.
- `GET /api/users`: lista usuários.
- `POST /api/users`: cria usuários.

## Desenvolvimento com Prisma

Após alterar `prisma/schema.prisma`, gere uma nova migração:

```bash
npx prisma migrate dev
```

Para inspecionar o banco visualmente:

```bash
npx prisma studio
```

Para regenerar o cliente Prisma, se necessário:

```bash
npx prisma generate
```

## Status

O projeto está em fase de desenvolvimento. A base funcional já cobre autenticação, grafo global, solicitações e revisão administrativa, mas ainda há pontos importantes de segurança, testes e maturidade operacional a evoluir antes de uso em produção.
