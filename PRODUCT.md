# Ruraliza - API Backend (produto)

Este documento diz o que o backend entrega e quais limites ele tem hoje. Uso da API, rotas e variáveis estão no [README](README.md); estrutura e decisões técnicas em [docs/architecture.md](docs/architecture.md). Onde algo é suposição e não fato observado no repositório, o texto avisa.

## Problema e objetivo

O Ruraliza (AgTech) conecta produtores rurais a trabalhadores, prestadores e estudantes, para facilitar a contratação de serviços operacionais nas fazendas. Este repositório é a API que sustenta o app (frontend Angular em `../ruraliza-frontend`). O objetivo da API é cobrir o caminho completo de uma contratação: publicar a vaga, receber candidaturas, aceitar, conversar, concluir, pagar (simulado) e avaliar, além de formação (trilhas) e de segurança da plataforma (verificação, denúncias).

## Quem usa

- **Produtor:** cadastra fazendas (com ponto no mapa), publica e gerencia vagas, analisa candidaturas, libera o pagamento, avalia o trabalhador e vê o painel da fazenda.
- **Trabalhador (também prestador ou estudante):** busca e recebe recomendações de vagas, se candidata, conversa com o produtor, estuda trilhas e recebe certificados, avalia a fazenda.
- **Conta com os dois perfis:** uma pessoa pode ser produtor e trabalhador com o mesmo e-mail e senha, mas não se candidata a uma vaga que ela mesma publicou.
- **Equipe (usuários de sistema, sem cadastro público):** `admin` gerencia contas, equipe, trilhas, ajuda, patrocínios, denúncias e verificações; `tutor` cria e edita as trilhas de que é tutor. As permissões estão em `src/modules/system-users/domain/system-user.ts`.

## Fluxos implementados

Cada item existe em código e tem rotas documentadas no README (seção "Rotas").

- **Cadastro e acesso:** conta por pessoa (e-mail e CPF únicos), aceite dos termos (`accept_terms`), login com token Bearer, troca de painel, redefinição de senha (resposta genérica, o código nunca volta na resposta; sem e-mail, só funciona no `npm run dev`, com o código no terminal).
- **Vagas:** publicar, editar, cancelar, prazo (`expires_at`), busca com filtros e ordenação, recomendações e avisos de vaga nova.
- **Tipos de serviço:** lista fixa em dois níveis, grupo > serviço (`src/modules/services/domain/categories.ts`). Só entram trabalhos do dia a dia da fazenda que não exigem curso nem certificação obrigatória. A vaga, as preferências, os patrocínios e as trilhas guardam o serviço; o grupo serve para escolher e filtrar.
  - Lavoura e horta: Colheita, Plantio, Pulverização, Capina, Preparo de canteiro, Ensacamento e seleção de grãos.
  - Cercas e construções: Conserto de cerca, Construção de cerca, Troca de mourões e esticadores, Porteiras e colchetes, Curral, brete e tronco, Reforma de galpão, paiol e cocho, Pequenas obras de alvenaria, Manutenção.
  - Água: Encanamento e caixa d'água, Limpeza de represa, açude e cisterna, Instalação e manutenção de irrigação, Conserto de roda d'água e carneiro hidráulico.
  - Pasto e terreno: Roçada manual, Limpeza de pasto, Aceiro manual, Conservação de estrada interna, Poda manual.
  - Animais: Manejo de gado, Vaqueiro e peão, Ordenha, Trato de animais, Casqueamento e ferrageamento, Doma e lida com cavalos.
  - Máquinas: Operação de máquinas.
  - Outros: Outros.
- **Candidatura e aceite:** candidatar, desistir, aceitar ou recusar; as demais candidaturas são recusadas pelo aceite.
- **Conversa:** abre no aceite, WhatsApp só aparece com consentimento dos dois, números e e-mails nas mensagens são ocultados.
- **Pagamento simulado:** o produtor "libera" o pagamento de um serviço em andamento e o serviço fica concluído. Não há dinheiro real.
- **Avaliações:** dupla e cega, prazo de 14 dias, reputação ponderada.
- **Trilhas e certificados:** tutores montam, trabalhadores estudam, o certificado sai ao concluir a última aula, com código e resumo SHA-256 validados em rota pública.
- **Notificações:** central por perfil, push (Web Push) e tempo real por SSE.
- **Denúncias, verificação de identidade e moderação** pela equipe, **patrocínios** (cartão "Patrocinado"), **central de ajuda** editável, **painel da fazenda** e fotos e currículo em PDF.

## Restrições

Fatos observados:

- **Dados em PostgreSQL quando o servidor tem `DATABASE_URL`**; sem ela, em memória: tudo (inclusive fotos, currículos e inscrições de push) some quando o servidor reinicia. O seed cria as contas e os dados de teste, também em produção, enquanto o app é só de demonstração (`SEED_DEMO=false` desliga): a cada subida em memória e uma vez por banco no PostgreSQL, onde as contas de teste ficam gravadas até alguém removê-las.
- **Uma instância só:** o aviso em tempo real (`InMemoryChangeFeed`) só vale para um processo.
- **Deploy no Render** (citado no README e no `.env.example`). Não há `render.yaml` nem Dockerfile no repositório, então a configuração do serviço vive no painel do Render.
- **E-mail não existe.** Por isso a redefinição pública fica desligada em produção (`TODO(email)`): a API responde o mesmo 200 e não cria código.
- **Integrações dependem de ambiente:** push depende das chaves VAPID e o mapa, de `GOOGLE_MAPS_API_KEY`; sem elas as rotas de configuração respondem 503.
- Sem `AUTH_TOKEN_SECRET`, o segredo é temporário e as sessões caem a cada reinício.
- Mensagens da API em português; status de domínio em inglês (`Pending`, `In Progress`...).

## Fora do escopo (hoje)

Envio de e-mail, pagamento real, assinatura digital dos certificados, registro de horas e relatórios em PDF, várias instâncias da API. Esses itens estão em "Próximos passos" do README.

## Decisões pendentes

- **Banco de dados em produção:** a persistência em PostgreSQL (`DATABASE_URL`) e os arquivos em bucket do Supabase Storage (`SUPABASE_*`) estão implementados; ligar em produção, e com qual provedor, é decisão da equipe. Veja "Armazenamento" no README.
- **Revisão jurídica dos termos de uso e da política de privacidade:** informada pela equipe; não há registro dela no repositório. Os textos ficam no frontend e a versão aceita é guardada em `TERMS_VERSION` (`src/modules/accounts/domain/terms.ts`).
- **HTTP/2:** informada pela equipe como pendente; no repositório só consta que, em HTTP/1.1, o limite de 6 conexões por servidor motivou o stream único por perfil (`/live`).
- **e-CNPJ ICP-Brasil** para assinar certificados (a API de assinatura do gov.br é só para órgãos públicos).
- Suposição: a ordem dessas decisões ainda não foi definida.

## Critérios de aceite

Cada resultado abaixo é observável e coberto por testes existentes (`npm test`).

| Resultado observável | Evidência |
|---|---|
| Produtor publica vaga, trabalhador se candidata, o aceite coloca o serviço em andamento e o pagamento o conclui | `tests/integration/hiring-flow.test.ts`, `tests/e2e/smoke.e2e.ts` |
| Vaga vencida some da busca e recusa candidaturas (409) até renovar o prazo | `tests/integration/hiring-flow.test.ts` |
| Só o trabalhador aceito recebe as coordenadas da fazenda | `tests/integration/hiring-flow.test.ts` |
| Rota protegida sem token dá 401; token de outra pessoa dá 403 | `tests/e2e/smoke.e2e.ts`, `src/modules/auth/presentation/access.spec.ts` |
| Remover perfil com serviço em andamento dá 409 e não apaga nada | `tests/integration/accounts-and-profiles.test.ts` |
| Mudanças em candidaturas chegam pelos streams SSE | `tests/integration/notifications.test.ts` |
| Falha do serviço de push não afeta a resposta da operação | `tests/integration/notifications.test.ts` |
| Concluir a última aula emite o certificado; trilha descontinuada não aceita aluno novo | `tests/integration/tracks.test.ts` |
| Foto vira WebP quadrado; arquivo que não é imagem ou PDF é recusado | `tests/integration/files.test.ts` |
| Toda resposta da API bate com o OpenAPI documentado | `tests/e2e/smoke.e2e.ts` com `tests/e2e/support/openapi-check.ts` |
| O seed entrega as contas e dados de teste descritos no README | `tests/setup/seed.test.ts` |
| Em produção as contas de teste sobem por padrão; com `SEED_DEMO=false` não, e a equipe depende de `ADMIN_*` | `tests/setup/boot.test.ts` |
| "Esqueci a senha" responde igual com e sem conta e nunca devolve o código | `src/modules/auth/application/password-reset.usecase.spec.ts`, `tests/e2e/smoke.e2e.ts` |
| Tipos do contrato batem com os do frontend | `npm run check:contracts` (precisa do frontend ao lado; não faz parte do `npm test`) |

Regras de negócio de cada caso de uso (avaliações, conversas, denúncias, verificação, patrocínios) têm testes unitários `*.spec.ts` ao lado do código (77 arquivos).

## Manutenção

Atualize este documento quando mudar o objetivo, o escopo, as restrições ou os critérios de aceite. Remova daqui o que sair de "pendente" quando for decidido.
