# Diagramas

Diagramas em Mermaid da arquitetura descrita em [architecture.md](architecture.md). Quando os dois divergirem, vale o código e depois o `architecture.md`; atualize os dois juntos.

## Visão geral

O app Angular fala só com a API. A persistência é escolhida na subida: PostgreSQL com `DATABASE_URL`, memória sem ela. Push e Supabase Storage são opcionais e ligados por variáveis de ambiente.

```mermaid
flowchart LR
  app["App Angular<br/>(ruraliza-frontend)"]

  subgraph api["API Express (app.ts)"]
    http["CORS, parsers de corpo,<br/>rotas, 404 e erros"]
    docs["OpenAPI<br/>/api/docs"]
    sse["SSE<br/>(ChangeFeed)"]
    container["container.ts<br/>casos de uso"]
  end

  subgraph dados["Persistência"]
    pg[("PostgreSQL<br/>DATABASE_URL")]
    mem[("Memória<br/>(testes e dev)")]
    supa[("Supabase Storage<br/>SUPABASE_*")]
  end

  push["Web Push<br/>VAPID_*"]

  app -- "HTTP + Bearer" --> http
  app -. "EventSource" .-> sse
  http --> container
  http --> docs
  container --> sse
  container --> pg
  container --> mem
  container --> supa
  container -. "em segundo plano" .-> push
```

## Camadas de um módulo

`presentation -> application -> domain <- infra`. O caso de uso só conhece as portas; o container escolhe a implementação.

```mermaid
flowchart TB
  subgraph mod["src/modules/&lt;módulo&gt;"]
    index["index.ts<br/>(entrada pública #modules/&lt;módulo&gt;)"]
    module["&lt;módulo&gt;.module.ts"]
    contract["*.contract.ts<br/>(tipos iguais aos do frontend)"]
    pres["presentation/<br/>routes, controller, parsers, schemas"]
    appl["application/<br/>*.usecase.ts"]
    dom["domain/<br/>portas e regras"]
    infra["infra/<br/>in-memory-*, pg-*"]
  end

  shared["src/shared<br/>domain, infra, utils"]
  container["src/container.ts"]

  index --> module
  module --> pres
  module --> appl
  pres --> appl
  appl --> dom
  infra -- "implementa" --> dom
  container -- "liga" --> infra
  container -- "monta" --> module
  pres --> contract
  mod --> shared
```

## Fluxo de uma requisição

```mermaid
sequenceDiagram
  autonumber
  participant C as App
  participant A as app.ts
  participant R as route()
  participant Ac as Access
  participant Ct as Controller
  participant U as Caso de uso
  participant Rp as Repository
  participant F as ChangeFeed

  C->>A: requisição HTTP
  A->>R: CORS, parsers, roteador do prefixo
  R->>Ac: authorize(req)
  alt token inválido ou sem permissão
    Ac-->>C: 401 ou 403
  end
  R->>Ct: handler
  Ct->>Ct: valida req.body e req.query
  Ct->>U: entrada tipada
  U->>Rp: porta (PostgreSQL ou memória)
  Rp-->>U: cópias das entidades
  U-->>F: publica mudança (SSE)
  U-->>Ct: Result ok ou falha
  alt falha
    Ct-->>C: sendFailure: 400, 401, 403, 404 ou 409
  else ok
    Ct-->>C: 200 ou 201 com JSON
  end
  Note over A,C: erro não tratado: errorHandler (400, 409, 413 ou 500)
```

## Dependências entre módulos

Imports `#modules/<módulo>` fora de testes. Quase todo módulo importa `auth` (as políticas de `Access`), então essas setas ficam de fora. Os módulos do núcleo se importam entre si em vários sentidos e aparecem agrupados; a seta para o grupo quer dizer que o módulo usa um ou mais deles.

```mermaid
flowchart LR
  auth["auth"]

  subgraph core["Núcleo (dependências mútuas)"]
    accounts
    farmers
    workers
    farms
    services
    hiring
    reviews
    notifications
  end

  admin --> core
  admin --> media
  chat --> core
  farm-stats --> core
  matching --> core
  matching --> tracks
  media --> core
  reports --> core
  sponsors --> core
  verification --> core
  tracks --> core
  tracks --> system-users

  auth --> core
  auth --> chat
  auth --> system-users

  help
  live
  platform
```

`help`, `live`, `platform` e `system-users` não dependem de outro módulo além de `auth` (`platform` nem dele).
