# Diagramas do banco de dados

Diagramas entidade-relacionamento do PostgreSQL do Ruraliza, gerados a partir de `src/migrations/001-initial.ts`, a única migration do projeto. As colunas foram conferidas com os repositórios `src/modules/*/infra/pg-*.ts` e com `src/shared/infra/postgres/pg-file-store.ts`, e não há divergência.

São 24 tabelas e 44 relacionamentos. A tabela de controle `schema_migrations` não aparece nos diagramas.

## Como ler

- **Linha contínua:** chave estrangeira real no banco. São só 3: `accounts.farmer_id`, `accounts.worker_id` e `chat_messages.chat_id`.
- **Linha tracejada:** relação lógica. A coluna guarda o id de outra tabela, mas o banco não tem `REFERENCES`; quem garante a ligação são os casos de uso. Nos diagramas detalhados, essas colunas aparecem como `FK` com a nota "lógica".
- **PK, FK e UK:** chave primária, chave estrangeira e restrição de unicidade. "UK composta" indica um `UNIQUE` de várias colunas.
- **Relação polimórfica:** `notifications`, `verifications` e `reports` apontam para `farmers` ou `workers` conforme a coluna `role`, `reporter_role` ou `target_type`. Por isso têm uma linha para cada tabela possível.
- **Lista de ids:** `farmers.farms` (`integer[]`) repete os ids das fazendas, e `tracks.tutor_ids` (`integer[]`) liga trilhas a usuários da equipe em N:N, sem tabela de junção.
- **Arquivos:** `photo_url`, `resume_url`, `document_id`, `image_url` e as fotos de `farms.photos` guardam ids de arquivos. Esses arquivos ficam em `stored_files` ou no bucket do Supabase Storage, quando ele está configurado.
- **`double_precision`:** é o tipo `double precision`. O Mermaid não aceita espaço no nome do tipo.
- **Tabelas cinza:** nos diagramas por área, são tabelas de outra área, mostradas só com a chave.
- **Restrição que não aparece no desenho:** o índice único parcial `applications_one_accepted`, que permite só uma candidatura com `status = 'Accepted'` por serviço.

## Arquivos

| Diagrama | Arquivos |
|---|---|
| Visão geral (só nomes e relacionamentos, para slides) | `banco-geral.mmd`, `.svg`, `.png` |
| Conta e acesso | `banco-conta-acesso.mmd`, `.svg`, `.png` |
| Fazendas e vagas | `banco-fazendas-vagas.mmd`, `.svg`, `.png` |
| Candidaturas e pagamentos | `banco-candidaturas-pagamentos.mmd`, `.svg`, `.png` |
| Capacitação | `banco-capacitacao.mmd`, `.svg`, `.png` |
| Comunicação | `banco-comunicacao.mmd`, `.svg`, `.png` |
| Confiança | `banco-confianca.mmd`, `.svg`, `.png` |
| Equipe interna, conteúdo e arquivos | `banco-equipe-conteudo-arquivos.mmd`, `.svg`, `.png` |

Na visão geral, cada área tem uma cor. Nos diagramas por área aparecem só os relacionamentos em que a tabela que guarda a chave pertence à área. A exceção é `stored_files`, que mostra todas as tabelas que guardam arquivos.

## Tabelas por área

### Conta e acesso
- `accounts`: conta de login (e-mail, hash da senha, termos aceitos, preferências), ligada a até um perfil de produtor e um de trabalhador.
- `farmers`: perfil de produtor rural.
- `workers`: perfil de trabalhador, prestador ou estudante, com experiência e currículo.
- `push_subscriptions`: inscrições de notificação push de cada navegador da conta.

### Fazendas e vagas
- `farms`: fazendas do produtor, com endereço, coordenadas e fotos.
- `services`: vagas (serviços) publicadas, com fazenda, preço, prazo, status e trabalhador contratado.
- `job_preferences`: interesses do trabalhador (categorias, local) para recomendações e alertas.
- `job_alerts`: registro dos alertas de vaga nova já enviados a cada trabalhador.

### Candidaturas e pagamentos
- `applications`: candidaturas de trabalhadores às vagas. É a tabela de junção N:N entre `services` e `workers`.
- `payments`: pagamento (simulado) de um serviço concluído, um por serviço.

### Capacitação
- `tracks`: trilhas de formação, com módulos e aulas em `jsonb` e tutores responsáveis.
- `enrollments`: matrícula e progresso do trabalhador numa trilha. É a tabela de junção N:N entre `tracks` e `workers`.
- `certificates`: certificados emitidos ao concluir uma trilha, com código público e resumo SHA-256.

### Comunicação
- `chats`: conversa entre produtor e trabalhador sobre um serviço, com o consentimento para mostrar o telefone.
- `chat_messages`: mensagens de cada conversa.
- `notifications`: central de avisos de cada perfil.

### Confiança
- `worker_reviews`: avaliação do trabalhador pelo produtor, uma por serviço, cega até os dois avaliarem.
- `farm_reviews`: avaliação da fazenda pelo trabalhador, uma por serviço, cega até os dois avaliarem.
- `reports`: denúncias contra um serviço, um produtor ou um trabalhador.
- `verifications`: pedidos de verificação de identidade, um por perfil.

### Equipe interna, conteúdo e arquivos
- `system_users`: usuários da equipe interna (admin e tutor).
- `help_articles`: perguntas e respostas da central de ajuda.
- `sponsors`: anúncios patrocinados, com público, período e contadores de exibição e clique.
- `stored_files`: bytes das fotos, currículos e fotos de documento quando o Supabase Storage não está configurado.

## Como gerar de novo

Na pasta `docs/diagramas/`:

```bash
for f in banco-*.mmd; do
  npx -y @mermaid-js/mermaid-cli -i "$f" -o "${f%.mmd}.svg" -b white -w 1600
  npx -y @mermaid-js/mermaid-cli -i "$f" -o "${f%.mmd}.png" -b white -w 1600 -s 3
done
```

Os diagramas usam o layout ELK (`config: layout: elk`) e foram gerados com o Mermaid CLI 11.16.0.
