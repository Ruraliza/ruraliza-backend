# Qualidade

O que cada verificação prova, quando rodar e como revisar. As ferramentas de agente e as evidências da adoção estão em [setup.md](setup.md).

## Comandos

| Comando | O que prova | Quando rodar |
|---|---|---|
| `npm run typecheck` | Os tipos fecham com o compilador estrito (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) | Toda mudança de código |
| `npm run lint` | ESLint com `strictTypeChecked`: sem `any`, sem promessa solta e sem arquivo acima de 350 linhas | Toda mudança de código |
| `npm run check:rules` | As regras locais de lint (`eslint-rules/`) funcionam: o autoteste do toolkit passa | Ao atualizar `eslint-rules/` (também roda no `npm test`) |
| `npm run test:unit` | Os casos de uso de cada módulo, com repositórios em memória (`src/**/*.spec.ts`) | Mudança num módulo |
| `npm run test:integration` | Os fluxos entre módulos pelo container, sem HTTP, e o seed | Mudança que cruza módulos |
| `npm run test:e2e` | O HTTP de verdade: o fluxo completo, os casos de erro e **toda resposta conferida contra o OpenAPI** | Mudança de rota, de resposta ou de schema |
| `npm run check:contracts` | Os tipos da API batem com os models do frontend (precisa de `../ruraliza-frontend`) | Mudança de contrato |
| `npm run build` | O `tsc` gera o `dist/` de produção | Antes de entregar |
| `npm test` | Tipos, lint, regras, unitários, integração e e2e, em ordem | Antes de pedir revisão |

O CI (`.github/workflows/ci.yml`) roda `npm test` e `npm run build` em cada PR e em cada push na `main`. Ele não publica nada e não é exigido para fazer merge. O `check:contracts` fica fora do CI porque precisa do outro repositório.

## Regras de base

- TypeScript estrito e `strictTypeChecked`, sem `any` explícito nem vindo de bibliotecas. `no-floating-promises` e `no-misused-promises` são erro (fazem parte do preset).
- **350 linhas por arquivo** (`quality/max-lines`, copiada do Vibe Coding Toolkit). É erro no código e só aviso nos testes. Hoje há um aviso, `tests/e2e/smoke.e2e.ts` (1489 linhas); dividi-lo por fluxo é uma tarefa à parte.
- Entrada validada em tempo de execução (`src/shared/infra/http/body.ts` e os parsers de cada módulo), nunca só pelo tipo.
- Toda rota documentada no OpenAPI. O e2e falha se uma resposta tiver campo a mais ou status sem documentação.
- Erros em português, sem stack nem segredo. A API ainda não tem um logger: os poucos `console` (inicialização, push, avisos de vaga) são a saída de log. Por isso a regra `quality/no-direct-console` do toolkit não foi ligada; ela volta quando existir um logger.
- `quality/no-direct-data-access` não se aplica: não há cliente de banco.

## Estratégia de testes

- Caso de uso novo ganha teste unitário ao lado (`*.spec.ts`), com os repositórios em memória e as fixtures de `testing/`.
- Correção de bug começa por um teste que falha e passa depois da correção.
- Fluxo que cruza módulos vai para `tests/integration`. Rota nova ou alterada entra no `tests/e2e/smoke.e2e.ts`, que também valida o schema.
- Os testes não usam rede, credenciais nem banco.

## Dependências

- `npm audit` em 18/10/2026: 2 avisos **moderados** do `uuid` dentro do `sequelize` (GHSA-w5hq-g745-h8pq). A correção automática faz downgrade para o `sequelize` 3 e por isso não foi aplicada. O `sequelize` não é importado por nenhum código, então o risco é só de instalação; reavaliar quando o PostgreSQL entrar.
- O `pg-harness`, sem uso, saiu em 18/10/2026. Ele trazia 2 avisos críticos e 3 altos.
- O `package-lock.json` está no `.gitignore`, então cada instalação pode resolver versões diferentes. Versionar o lockfile é uma decisão da equipe.

## Revisão depois de implementar

- O escopo da revisão segue o risco e o diff real: requisitos e comportamento, regressões e testes, segurança e dados, contratos com o frontend.
- Mudança não trivial ganha revisão independente quando houver como fazê-la. Ela cobre a faixa exata de commits e o que está fora do commit, além dos chamadores, contratos e testes afetados.
- Revisores só leem e devolvem cada achado com severidade, local, cenário de falha e evidência. Quem coordena confere os achados e remove duplicatas. As correções voltam para quem escreveu o código.
- Termina quando os achados relevantes estão resolvidos ou com destino explícito, as verificações afetadas passam e os riscos restantes estão registrados. Outra rodada só com evidência nova, risco aberto ou pedido explícito.
- Mudança em autenticação, permissões, tokens, dados pessoais (CPF, telefone, documentos da verificação) ou uploads usa a skill `differential-review`, ou faz o mesmo rastreamento à mão se ela não estiver disponível.

## Revisão de segurança

Para uma revisão de linha de base do repositório inteiro ou de um diff exato, use o prompt 13 do toolkit. A fonte é `docs/prompts/13-security-review.md` em [soumatheusgomes/vibe-coding-toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit), na revisão `de66fe3`. O link abaixo é fixo nessa revisão, para o agente rodar exatamente o texto que foi revisado. Peça ao agente:

```text
Read https://raw.githubusercontent.com/soumatheusgomes/vibe-coding-toolkit/de66fe371a49f5a4d3b521759e5c401f390b6424/docs/prompts/13-security-review.md and execute the entire "Prompt" block in this repository. Use repository mode, preserve my current client/model/authentication, and save a redacted report outside the repository.
```

Para um diff, troque o modo por `Use diff mode, base=<ref>, head=<ref>, comparison=merge-base, dirty=exclude`.

- A revisão só lê: não corrige, não instala, não faz checkout e não acessa o Render nem outro serviço publicado.
- O relatório fica fora do repositório, numa pasta pessoal, com o mínimo de evidência e sem segredos. Achados sensíveis não entram em issues públicas.
- Corrigir os achados é uma tarefa separada, com teste de regressão.
- Uma revisão sem achados não prova que o projeto é seguro.
- Para atualizar, compare o prompt com a revisão nova do toolkit e registre a revisão usada em [setup.md](setup.md).

## Continuidade

Trabalho que atravessa sessões ganha um handoff no plano ou na tarefa que já existe:

- **Objetivo e aceite:** o resultado pedido e o critério observável.
- **Estado conferido:** a data, o commit e as mudanças locais.
- **Feito:** o que mudou e onde.
- **Evidência:** os comandos e resultados, com data, incluindo o que falhou e o que não rodou.
- **Falta:** a próxima ação, as dependências e os riscos.
- **Bloqueios:** a causa, o que depende dele e a condição para retomar.
- **Recursos:** processos, portas e pastas temporárias que ainda precisam de limpeza.

O handoff é contexto, não prova. Antes de retomar, confira arquivos, git, verificações e processos.

## Manutenção

Mudou um script, uma regra ou uma verificação? Atualize este documento na mesma mudança. As verificações são comandos explícitos: não há hook do git nem bloqueio de branch.
