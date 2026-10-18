# Design da API

Este repositório é só a API: não tem interface. Critérios visuais (cores, tipografia, espaçamento, contraste, foco, movimento, breakpoints, estados de tela) **não se aplicam aqui**. Eles pertencem ao frontend em `../ruraliza-frontend`, e a fonte de verdade da interface é o `docs/design.md` de lá.

O que cabe neste repositório é a "experiência" de quem consome a API. As convenções abaixo foram conferidas no código; o README (seções "Rotas" e "Tipagem") tem os detalhes por rota.

## Convenções que existem

- **Formato de erro:** sempre `{ "error": "mensagem" }` (`ApiError`, `src/shared/contracts/api.ts`). A tradução de falha de negócio para status fica em `src/shared/infra/http/respond.ts`.
- **Status HTTP:** 400 entrada inválida, 401 sem sessão válida ou e-mail/senha incorretos, 403 sem permissão ou recurso de outro dono, 404 não encontrado, 409 conflito de estado, 413 arquivo grande demais, 503 integração não configurada (mapa, push), 500 erro interno sem detalhes. O 401 de sessão traz `WWW-Authenticate: Bearer realm="ruraliza"`, exposto ao CORS, para o frontend distinguir sessão vencida de senha errada.
- **Idioma das mensagens de erro:** português, escrito para a pessoa que usa o app (ex.: "Há palavras não permitidas no nome do serviço. Reescreva sem palavrões nem ofensas.").
- **Nomes de campo:** `snake_case` (`farmer_id`, `expires_at`, `insertion_date`), os mesmos dos models do frontend; o `check:contracts` falha se divergirem.
- **Sucesso:** POST e PATCH respondem `{ message, <entidade> }`; GET devolve o recurso ou a lista. 201 na criação.
- **Datas:** prazo da vaga como dia do calendário `AAAA-MM-DD`, válido até o fim do dia no horário de Brasília; instantes como texto ISO.
- **Dados sensíveis:** CPF com 11 dígitos na entrada e mascarado em listas; telefone e e-mail do trabalhador mascarados até a conversa liberar; coordenadas da fazenda só para o trabalhador aceito.
- **Tempo real:** eventos SSE sem corpo útil (`data: {}`); a tela busca o dado de novo pela rota normal.

## Inconsistências observadas

- Os textos de `message` dos sucessos estão **em inglês** (`Farmer created successfully!`, `Review saved.`), enquanto `error` e os dados mostrados à pessoa estão em português. O frontend não deve exibir `message`. O README diz "Erros sempre no formato `{ error }`", mas não fixa o idioma de `message`.
- Status de domínio vão em inglês (`Pending`, `In Progress`, `Completed`, `Rejected`, `Cancelled`; `Accepted`; `draft`, `published`, `discontinued`), por decisão registrada no README, enquanto motivos de denúncia e temas da ajuda vão em português (`fraude`, `comecar`).

Nenhuma dessas inconsistências foi corrigida; mudar qualquer uma é mudança de contrato e exige alterar os dois repositórios.

## Revisão e manutenção

Rota nova entra com schema OpenAPI (senão o e2e falha) e segue as convenções acima. Mudou uma convenção, atualize este arquivo e o README. Orientação de interface, quando necessária, vai para o repositório do frontend.
