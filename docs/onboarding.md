# Preparação local

Passo a passo para rodar e verificar o backend. Uso da API, usuários de teste e tabela de variáveis estão no [README](../README.md), seções "Como executar" e "Configuração (`.env`)"; aqui só o caminho curto.

## Pré-requisitos

- **Node.js e npm.** O README pede Node 20 ou superior; `package.json` não declara `engines`. A versão observada ao preparar estes documentos foi a **v24.19.0**. Não foi testada outra versão, então 20 é a promessa do README, não algo verificado aqui.
- **Frontend ao lado (opcional):** `npm run check:contracts` lê `../ruraliza-frontend/src/app/core/models`, então o repositório `ruraliza-frontend` precisa estar clonado na mesma pasta pai. Os demais comandos não dependem dele.
- Nenhuma ferramenta global além do Node. Não é preciso banco, Docker nem serviço externo.

## Primeira execução

```bash
cp .env.example .env
npm install
npm run dev
```

O servidor sobe em `http://localhost:3000/api` (porta em `PORT`), reinicia ao salvar e carrega os dados de teste (só porque `npm run dev` passa `--dev`; `npm start` não carrega o seed, e lá a equipe entra por `ADMIN_EMAIL`/`ADMIN_PASSWORD` ou pelo administrador padrão `admin@ruraliza.app`, com a senha sorteada que sai no log). No "esqueci a senha", o código aparece no terminal da API, no lugar do e-mail. A raiz `/` redireciona para o Swagger UI em `/api/docs`. Contas de teste e senha estão no README ("Usuários de teste").

`npm start` compila para `dist/` e roda o JavaScript gerado, como no deploy.

## Variáveis de ambiente

O `.env` fica fora do git. O `.env.example` explica cada variável. Nomes disponíveis:

- `PORT`, `CORS_ORIGINS` (no `.env` local, libere o Angular em desenvolvimento: `http://localhost:4200`).
- `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID` (mapa; sem a chave, `GET /api/config/maps` responde 503).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (push; gere o par com `npx web-push generate-vapid-keys`).
- `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`, `WHATSAPP_INSTANCE`, `APP_URL` (avisos por WhatsApp; as três primeiras juntas ligam o envio).
- `AUTH_TOKEN_SECRET` (assina as sessões; sem ele, o segredo é temporário e as sessões caem a cada reinício).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (primeiro administrador; em desenvolvimento o seed já cria `admin@exemplo.com`, em produção, sem elas, o servidor cria `admin@ruraliza.app` com uma senha sorteada que aparece no log e muda a cada reinício).
- `SEED_DEMO` (`true` liga o seed fora do `--dev`, só para um ambiente de demonstração: as contas usam a senha pública do README).

Para mexer só na API, o `.env` copiado do exemplo basta: tudo é opcional e as integrações ficam desligadas. Peça os valores reais à equipe; nunca os registre em arquivos versionados.

## Banco de dados

Não há. Os dados ficam em memória por decisão da equipe e somem a cada reinício; em desenvolvimento, o seed recria tudo. Não existe `DATABASE_URL`, migração ou script de banco. O plano para PostgreSQL está descrito em [architecture.md](architecture.md) (seção "Dados") e no README, e não está implementado.

## Verificar

```bash
npm test
```

Roda, em ordem: `typecheck`, `lint`, `check:rules` (autoteste das regras locais de lint), testes unitários (`src/**/*.spec.ts`), integração (`tests/integration` e `tests/setup`) e e2e (`tests/e2e/smoke.e2e.ts`, HTTP de verdade com validação contra o OpenAPI). Todos funcionam sem credenciais e sem rede. Também existem `npm run test:unit`, `test:integration`, `test:e2e` e `npm run build`. O `check:contracts` não faz parte do `npm test`.

## Agentes

Leia [AGENTS.md](../AGENTS.md). O [CLAUDE.md](../CLAUDE.md) importa as mesmas instruções. Consulte [setup.md](setup.md) para skills locais, integrações e escopos configurados, e [quality.md](quality.md) para os comandos de qualidade.

## Problemas conhecidos

- **`package-lock.json` não é versionado.** Ele está no `.gitignore` (junto com `node_modules/`, `dist/` e `.env`), então `npm install` não fixa versões e dois ambientes podem instalar versões diferentes dentro das faixas do `package.json`. Existe um `package-lock.json` local nesta máquina, mas ele não vem do git.
- **Dependências sem uso:** `pg` e `sequelize` estão instaladas, mas nada as importa ainda. O `npm audit` acusa 2 avisos moderados do `uuid` dentro do `sequelize`; a única correção oferecida é um downgrade, por isso fica registrada em [quality.md](quality.md).
