# Familiar Graph

Familiar Graph e uma aplicacao web para construir, visualizar e documentar grafos tematicos. O foco principal do projeto e o **Grafo Global**, uma visualizacao interativa onde nos representam entidades como pessoas, eventos, documentos, lugares ou grupos, e arestas representam relacoes entre essas entidades.

A aplicacao combina grafo visual, curadoria administrativa, solicitacoes colaborativas, documentos ricos para ligacoes, tags oficiais com temas proprios e armazenamento de imagens no Azure Blob Storage.

## Visao geral

O sistema possui quatro experiencias principais:

- **Home (`/`)**: pagina de apresentacao do projeto, com secoes que mostram o grafo global, solicitacoes de nos, documentos de ligacao e painel de detalhes.
- **Login e cadastro (`/login`)**: autenticacao por e-mail e senha, cadastro com validacoes de seguranca e sessao por cookie HTTP-only.
- **Grafo global (`/global-graph`)**: grafo interativo com busca, filtro por tag, selecao de nos/arestas, sidebar de detalhes, modal de documentos e criacao de solicitacoes.
- **Admin (`/admin`)**: painel para revisar solicitacoes, criar nos diretamente, criar administradores, gerenciar tags oficiais, configurar temas e controlar relacoes permitidas por tag.

## Principais recursos

- Grafo global interativo renderizado com React Flow.
- Layout automatico dos nos usando ELK.js.
- Politica de janela do grafo com limite de ate 200 nos por recorte.
- Busca por nos dentro do tema ativo.
- Filtro por tags oficiais, com troca visual do tema do grafo.
- Persistencia da tag selecionada na URL por `tagSlug`.
- Sidebar de detalhes do no selecionado.
- Modal separado para documentos de ligacao ao clicar em uma aresta.
- Criacao de solicitacoes de novos nos por usuarios autenticados.
- Upload de foto para nos e documentos.
- Editor rico baseado em Quill para biografias e documentos.
- Citacoes internas digitando `@nome`, gerando links para nos ou ligacoes.
- Pagina de ligacao direta entre dois nos em `/global-graph/path`.
- Painel administrativo com revisao de solicitacoes.
- Criacao direta de nos e ligacoes por administradores.
- Edicao direta de nos e ligacoes no grafo global para administradores.
- Criacao de novos administradores apenas por administradores.
- Gerenciamento de tags oficiais pelo admin.
- Customizacao de cores por tag.
- Relacoes permitidas configuraveis por tag.
- Remocao de tag com exclusao dos nos, arestas, solicitacoes e imagens relacionadas no Azure.
- Armazenamento de imagens no Azure Blob Storage.
- Deploy por GitHub Actions para Azure App Service.

## Stack

- **Next.js 16.2.6** com App Router.
- **React 19.2.4**.
- **TypeScript**.
- **Prisma 7.8** com `@prisma/adapter-pg`.
- **PostgreSQL**.
- **React Flow (`@xyflow/react`)** para o grafo.
- **ELK.js** para layout automatico.
- **Quill 2** para editor de texto rico.
- **bcryptjs** para hash de senhas.
- **Azure Blob Storage** para imagens.
- **GitHub Actions** para build, migracoes e deploy.
- **ESLint** para analise estatica.

## Estrutura do projeto

```text
app/
  page.tsx                         # Home
  login/page.tsx                   # Login e cadastro
  global-graph/page.tsx            # Pagina principal do grafo global
  global-graph/path/page.tsx       # Documento/caminho entre dois nos
  admin/page.tsx                   # Painel administrativo
  api/                             # Rotas HTTP
  components/
    RichTextEditor.tsx             # Editor Quill usado em bios e documentos
    RichTextViewer.tsx             # Renderizador de HTML rico
    VantaNetBackground.tsx         # Background animado
    graph/                         # Componentes do grafo, modais, nos e arestas

lib/
  auth-security.ts                 # Validacao de e-mail/senha e rate limit simples
  azure-blob.ts                    # Upload e delecao de imagens no Azure Blob
  current-user.ts                  # Usuario atual a partir do cookie
  global-graph-window.ts           # Recorte de ate 200 nos do grafo
  global-graph-path.ts             # Caminho narrativo entre dois nos
  global-relations.ts              # Relacoes padrao e por tag
  global-tags.ts                   # Tags oficiais e temas padrao
  global-tags-server.ts            # CRUD de tags no banco
  graph-layout.ts                  # Layout automatico com ELK
  keyboard-navigation.ts           # Navegacao de formularios por teclado
  prisma.ts                        # Cliente Prisma com adapter PostgreSQL

prisma/
  schema.prisma                    # Modelos, enums e relacoes
  migrations/                      # Migracoes versionadas

.github/workflows/
  main_familiar-graph-app.yml      # Build e deploy no Azure App Service

docker-compose.yml                 # PostgreSQL local
package.json                       # Scripts e dependencias
```

## Modelo de dados

O banco usa PostgreSQL e Prisma. Os nomes das tabelas principais sao mapeados com `@@map`.

### Usuarios

`User` representa uma conta do sistema.

Campos principais:

- `email`: unico.
- `password`: hash com `bcryptjs`.
- `name`: nome opcional.
- `role`: `USER` ou `ADMIN`.
- `createdAt`: data de criacao.

Um usuario pode criar solicitacoes, revisar solicitacoes como administrador, criar nos globais, criar arestas globais e possuir arvores privadas modeladas no banco.

### Grafo global

`GlobalNode` representa um no oficial do grafo global.

Campos principais:

- `name`
- `birthDate`
- `deathDate`
- `gender`
- `bio`
- `photoUrl`
- `tagSlug`
- `createdById`

`GlobalEdge` representa uma ligacao oficial entre dois nos.

Campos principais:

- `fromId`
- `toId`
- `relation`
- `description`
- `documentTitle`
- `documentContent`
- `documentImageUrl`
- `createdById`

A relacao de uma aresta e salva como string para permitir listas diferentes de relacoes por tag.

### Tags oficiais

`GlobalTag` define um tema oficial do grafo.

Campos principais:

- `slug`
- `label`
- `description`
- `background`
- `surface`
- `border`
- `primary`
- `secondary`
- `muted`
- `node`
- `nodeSelected`
- `edge`
- `edgeSelected`

`GlobalTagRelation` define quais relacoes sao permitidas em cada tag.

Campos principais:

- `tagSlug`
- `key`
- `label`

As tags padrao em codigo sao:

- `person`: pessoas e relacoes familiares ou sociais.
- `ww2`: eventos, unidades, locais e pessoas ligados a Segunda Guerra Mundial.
- `place`: cidades, regioes, propriedades e pontos geograficos.
- `document`: arquivos, registros, cartas, fotos e fontes historicas.

Quando existem tags no banco, a aplicacao usa as tags persistidas. Quando nao existem, usa as tags padrao em codigo como fallback.

### Solicitacoes de nos

`NodeRequest` guarda um no sugerido por usuario.

Campos principais:

- `userId`
- `status`: `PENDING`, `APPROVED` ou `REJECTED`.
- `nodeName`
- `nodeBirthDate`
- `nodeDeathDate`
- `nodeGender`
- `nodeBio`
- `nodePhotoUrl`
- `nodeTagSlug`
- `userNote`
- `adminNote`
- `reviewedById`
- `reviewedAt`

`NodeRequestConn` guarda as conexoes sugeridas entre o novo no e nos oficiais existentes.

Campos principais:

- `requestId`
- `globalNodeId`
- `relation`
- `newNodeIsFrom`
- `description`
- `documentTitle`
- `documentContent`
- `documentImageUrl`

### Arvores privadas

O schema tambem contem modelos para grafos privados:

- `PersonTree`
- `PersonNode`
- `PersonEdge`
- `PersonRelationLabel`

Esses modelos permitem arvores/grafos por usuario, com relacoes customizadas por arvore. A interface principal do projeto esta concentrada no Grafo Global.

## Como o grafo global carrega os dados

A pagina `/global-graph` usa `getGlobalGraphWindow`.

O carregamento segue esta regra:

1. Resolve a tag ativa usando `tagSlug`.
2. Escolhe um no de origem usando `nodeId` ou `seedNodeId`; se nenhum for informado, pega o primeiro no da tag em ordem alfabetica.
3. Busca apenas nos da tag ativa.
4. Percorre as conexoes a partir do no de origem.
5. Seleciona ate `GLOBAL_GRAPH_NODE_LIMIT`, atualmente `200`.
6. Se o recorte conectado nao chegar a 200 nos, completa com outros nos da mesma tag em ordem alfabetica.
7. Limita arestas no servidor para reduzir custo de renderizacao.
8. Aplica layout automatico no cliente com ELK.
9. Aplica uma politica visual adicional para reduzir sobreposicao de arestas quando o grafo esta muito denso.

Isso permite trabalhar com uma base maior no banco sem tentar renderizar todos os nos de uma vez.

## Tags, temas e relacoes

Cada no possui uma tag em `tagSlug`. A tag padrao e `person`.

As tags controlam:

- Nome publico do tema.
- Descricao.
- Paleta de cores do grafo.
- Cor de nos, arestas e elementos selecionados.
- Lista de relacoes permitidas.

No admin, uma tag pode ser criada, editada ou deletada. Ao deletar uma tag, o sistema tambem remove:

- Nos daquela tag.
- Arestas ligadas aos nos daquela tag.
- Solicitacoes daquela tag.
- Conexoes pendentes que apontavam para esses nos.
- Imagens encontradas nos campos de foto e nos HTMLs ricos relacionados.

A tag padrao `person` nao pode ser deletada.

## Editor rico

O projeto usa Quill em `RichTextEditor`.

Ele e usado em:

- Biografia de no.
- Documento de ligacao.
- Conteudo de solicitacoes.
- Edicao administrativa de nos e ligacoes.

Recursos disponiveis:

- Titulos.
- Fonte e tamanho.
- Negrito, italico, sublinhado e tachado.
- Cor de texto e cor de fundo.
- Blockquote.
- Listas ordenadas e nao ordenadas.
- Indentacao.
- Alinhamento.
- Links.
- Imagens.
- Limpeza de formatacao.
- Controles extras de espacamento de texto.
- Controles de alinhamento de bloco.
- Redimensionamento de imagem por porcentagem.
- Alinhamento de imagem.
- Espacamento vertical de imagem.
- Borda/cantos de imagem.

### Citacoes internas com `@`

Ao digitar `@` seguido de pelo menos dois caracteres dentro do editor, o componente consulta:

```text
GET /api/global-graph/citation-search?q=...&tagSlug=...
```

A busca retorna sugestoes de:

- Nos.
- Ligacoes.

Ao selecionar uma sugestao, o editor insere um link interno:

- Para no: `/global-graph?nodeId=...&tagSlug=...`
- Para ligacao: `/global-graph?edgeId=...&tagSlug=...`

Esses links sao renderizados pelo `RichTextViewer`.

## Imagens e Azure Blob Storage

As imagens sao armazenadas no Azure Blob Storage. O banco salva apenas a URL publica.

O helper principal e `lib/azure-blob.ts`.

Pastas usadas no container:

- `global-nodes`
- `node-requests`
- `private-nodes`
- `edge-documents`

Formatos aceitos:

- JPEG
- PNG
- WebP

Limite por imagem:

```text
5 MB
```

Variaveis de ambiente usadas:

```env
AZURE_BLOB_CONTAINER_URL="https://sua-conta.blob.core.windows.net/seu-container"
AZURE_BLOB_SAS_TOKEN="sp=...&sig=..."
AZURE_BLOB_PUBLIC_BASE_URL="https://sua-conta.blob.core.windows.net/seu-container"
```

Descricao:

- `AZURE_BLOB_CONTAINER_URL`: URL do container usado para upload e delecao.
- `AZURE_BLOB_SAS_TOKEN`: token SAS do container. O valor pode estar com ou sem `?` no inicio.
- `AZURE_BLOB_PUBLIC_BASE_URL`: base usada para montar a URL salva no banco. Pode ser a propria URL do container ou uma URL de CDN.

Permissoes do SAS:

- Para upload: permissao de criar/escrever.
- Para delecao de tags com imagens: permissao de deletar.
- Para leitura publica: o container precisa permitir leitura anonima ou a aplicacao precisa usar uma base publica/CDN apropriada.

O README nao deve conter tokens reais. Use apenas placeholders em arquivos versionados.

## Autenticacao e permissoes

A autenticacao usa e-mail e senha.

No cadastro e na criacao de admins, a senha precisa atender as regras de `lib/auth-security.ts`:

- Pelo menos 10 caracteres.
- Pelo menos uma letra maiuscula.
- Pelo menos uma letra minuscula.
- Pelo menos um numero.
- Pelo menos um simbolo.
- Sem espacos.

O login usa `bcryptjs` para comparar a senha enviada com o hash salvo no banco.

A sessao e controlada pelo cookie HTTP-only:

```text
provisional_user_id
```

O helper `getCurrentUser` le esse cookie e retorna:

- `id`
- `email`
- `name`
- `role`

Rotas administrativas verificam `role = ADMIN`.

### Criacao de administradores

Administradores podem criar outros administradores no painel `/admin`.

A API usada e:

```text
POST /api/admin/users
```

Somente usuarios autenticados com `role = ADMIN` podem usar essa rota.

## Rotas da aplicacao

### Paginas

- `/`: home.
- `/login`: login e cadastro.
- `/global-graph`: grafo global.
- `/global-graph/path`: pagina de ligacao direta entre dois nos.
- `/admin`: painel administrativo.
- `/admin/nodes`: rota administrativa relacionada a nos.
- `/admin/nodes/search`: rota administrativa de busca de nos.
- `/dev`: pagina de desenvolvimento.

### API publica/autenticada

- `POST /api/auth/register`: cria usuario comum.
- `POST /api/auth/login`: autentica usuario.
- `POST /api/auth/logout`: encerra sessao.
- `GET /api/global-graph`: carrega recorte do grafo global.
- `POST /api/global-graph`: cria no ou aresta global.
- `GET /api/global-graph/citation-search`: busca nos e ligacoes para citacoes internas.
- `GET /api/global-graph/path-search`: busca nos para montar ligacao direta.
- `GET /api/global-tags`: lista tags oficiais.
- `GET /api/nodes/search`: busca nos globais.
- `POST /api/node-requests`: cria solicitacao de novo no.
- `GET /api/graphs`: lista grafos privados do usuario autenticado.
- `POST /api/graphs`: cria grafo privado para o usuario autenticado.
- `GET /api/graphs/[treeId]`: carrega um grafo privado.
- `POST /api/graphs/[treeId]/nodes`: cria no em um grafo privado.
- `POST /api/graphs/[treeId]/edges`: cria aresta em um grafo privado.
- `GET /api/users`: lista usuarios.
- `POST /api/users`: cria usuario.

### API administrativa

- `GET /api/node-requests`: lista solicitacoes pendentes para admin.
- `POST /api/node-requests/approve`: aprova solicitacao.
- `POST /api/node-requests/reject`: rejeita solicitacao.
- `POST /api/admin/nodes`: cria no direto como admin.
- `POST /api/admin/nodes/bulk`: cria nos em lote como admin.
- `GET /api/admin/nodes/search`: busca nos no contexto admin.
- `POST /api/admin/users`: cria administrador.
- `GET /api/admin/global-tags`: lista tags para admin.
- `POST /api/admin/global-tags`: cria tag.
- `PATCH /api/admin/global-tags`: edita tag.
- `DELETE /api/admin/global-tags`: deleta tag e conteudo relacionado.
- `PATCH /api/admin/global-nodes/[id]`: edita no global.
- `PATCH /api/admin/global-edges/[id]`: edita aresta global.

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto.

Para desenvolvimento local com o `docker-compose.yml` deste repositorio:

```env
DATABASE_URL="postgresql://Brunobetiatto:Brunobetiatto1@localhost:5432/graphdb?schema=public"
```

Para Azure PostgreSQL, use o formato:

```env
DATABASE_URL="postgresql://USUARIO:SENHA_URL_ENCODED@HOST.postgres.database.azure.com:5432/graphdb?sslmode=require"
```

Para imagens:

```env
AZURE_BLOB_CONTAINER_URL="https://sua-conta.blob.core.windows.net/seu-container"
AZURE_BLOB_SAS_TOKEN="sp=...&sig=..."
AZURE_BLOB_PUBLIC_BASE_URL="https://sua-conta.blob.core.windows.net/seu-container"
```

No GitHub Actions, o workflow espera o secret:

```text
DATABASE_URL
```

O deploy no Azure tambem usa os secrets OIDC criados pelo App Service:

```text
AZUREAPPSERVICE_CLIENTID_...
AZUREAPPSERVICE_TENANTID_...
AZUREAPPSERVICE_SUBSCRIPTIONID_...
```

No Azure App Service, configure as mesmas variaveis em:

```text
Settings > Environment variables
```

## Como rodar localmente

Instale dependencias:

```bash
npm install
```

Suba o PostgreSQL local:

```bash
docker compose up -d
```

Aplique as migracoes:

```bash
npx prisma migrate dev
```

Inicie o servidor:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de producao
npm run start    # Servidor Next apos build
npm run lint     # ESLint
```

Comandos Prisma usados no projeto:

```bash
npx prisma migrate dev      # Cria/aplica migracao em desenvolvimento
npx prisma migrate deploy   # Aplica migracoes em producao/CI
npx prisma generate         # Gera Prisma Client
npx prisma studio           # Interface visual do banco
```

## Fluxo de uso

1. O visitante acessa `/`.
2. O usuario entra em `/login` para criar conta ou autenticar.
3. Apos login, ele e enviado para `/global-graph`.
4. No grafo global, ele escolhe uma tag, pesquisa nos e abre detalhes.
5. Ao selecionar um no, a sidebar mostra foto, tema, biografia e conexoes.
6. Ao selecionar uma aresta, o modal mostra o documento de ligacao renderizado com Quill.
7. Um usuario autenticado pode solicitar um novo no pelo modal do grafo.
8. A solicitacao pode incluir foto, biografia rica, tag, nota e conexoes opcionais.
9. O admin revisa solicitacoes em `/admin`.
10. Ao aprovar, a solicitacao vira `GlobalNode` e suas conexoes viram `GlobalEdge`.
11. O admin tambem pode criar conteudo diretamente e editar nos/arestas ja existentes.

## Ligacao direta

A funcionalidade de ligacao direta permite escolher dois nos no grafo global e montar uma pagina narrativa com o caminho entre eles.

Entrada:

```text
/global-graph/path?from=ID_DO_NO_INICIAL&to=ID_DO_NO_FINAL&tagSlug=TAG
```

A pagina mostra:

- No inicial.
- Biografia do no.
- Documento da ligacao para o proximo no.
- No seguinte.
- Repeticao dessa estrutura ate o no final.

Quando nao existe caminho entre os dois nos dentro da tag ativa, a pagina mostra um estado vazio.

## Deploy no Azure

O repositorio contem o workflow:

```text
.github/workflows/main_familiar-graph-app.yml
```

O workflow executa:

1. Checkout do repositorio.
2. Setup do Node.js 22.
3. `npm ci`.
4. `npx prisma generate`.
5. `npm run build`.
6. `npx prisma migrate deploy`.
7. `npm prune --omit=dev`.
8. Upload do artefato.
9. Login no Azure via OIDC.
10. Deploy para o Azure Web App `familiar-graph-app`.

Recursos Azure usados pela aplicacao:

- Azure App Service para hospedar o Next.js.
- Azure Database for PostgreSQL Flexible Server para o banco.
- Azure Blob Storage para imagens.

Configuracoes importantes no App Service:

- `DATABASE_URL`
- `AZURE_BLOB_CONTAINER_URL`
- `AZURE_BLOB_SAS_TOKEN`
- `AZURE_BLOB_PUBLIC_BASE_URL`

Para o PostgreSQL do Azure, a `DATABASE_URL` deve usar SSL:

```text
?sslmode=require
```

## Observacoes operacionais

- O arquivo `.env` nao deve ser commitado com credenciais reais.
- Tokens SAS devem ser tratados como segredo.
- O rate limit de autenticacao e em memoria no processo Node.
- A URL publica das imagens precisa ser acessivel pelo navegador.
- Ao apagar uma tag, o sistema tenta remover imagens do Azure que estejam em fotos e conteudos HTML relacionados.
- A janela do grafo e limitada para manter a interacao responsiva.
- As rotas administrativas dependem do cookie de sessao e do papel `ADMIN`.
