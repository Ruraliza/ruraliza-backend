import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { adjustableClock } from '#shared/testing/recorders';
import { unwrap } from '#shared/testing/unwrap';
import { createInMemoryHelpArticleRepository } from '../infra/in-memory-help-article.repository';
import { CreateHelpArticleUseCase } from './create-help-article.usecase';
import { createDefaultHelpArticles } from './default-help-articles';
import { DeleteHelpArticleUseCase } from './delete-help-article.usecase';
import type { HelpDeps } from './help-deps';
import { ListAllHelpUseCase } from './list-all-help.usecase';
import { ListPublishedHelpUseCase } from './list-published-help.usecase';
import { MoveHelpArticleUseCase } from './move-help-article.usecase';
import { UpdateHelpArticleUseCase } from './update-help-article.usecase';

describe('Central de ajuda', () => {
  let deps: HelpDeps & { clock: ReturnType<typeof adjustableClock> };

  beforeEach(() => {
    deps = { helpArticles: createInMemoryHelpArticleRepository(), clock: adjustableClock('2026-10-01T10:00:00.000Z') };
  });

  it('as perguntas padrão saem por tema, na ordem da tela', async () => {
    await createDefaultHelpArticles(deps.helpArticles, '2026-10-01T10:00:00.000Z');

    const list = await new ListPublishedHelpUseCase(deps).execute();

    assert.equal(list[0]?.question, 'O que é o Ruraliza?');
    assert.equal(list.at(-1)?.topic, 'conta');
    const topics = list.map((a) => a.topic).filter((t, i, all) => all.indexOf(t) === i);
    assert.deepEqual(topics, ['comecar', 'produtores', 'trabalhadores', 'pagamentos', 'seguranca', 'trilhas', 'conta']);
  });

  it('pergunta nova entra no fim do tema; rascunho só aparece na gestão', async () => {
    const create = new CreateHelpArticleUseCase(deps);
    const first = await create.execute({ question: 'A?', answer: 'a', topic: 'pagamentos' });
    const draft = await create.execute({ question: 'B?', answer: 'b', topic: 'pagamentos', published: false });

    assert.deepEqual([first.position, draft.position], [1, 2]);
    assert.deepEqual((await new ListPublishedHelpUseCase(deps).execute()).map((a) => a.question), ['A?']);
    assert.deepEqual((await new ListAllHelpUseCase(deps).execute()).map((a) => a.question), ['A?', 'B?']);
  });

  it('editar troca só o que veio; mudar de tema leva para o fim do tema novo', async () => {
    const create = new CreateHelpArticleUseCase(deps);
    await create.execute({ question: 'Conta 1?', answer: 'x', topic: 'conta' });
    const moving = await create.execute({ question: 'Antiga?', answer: 'y', topic: 'pagamentos' });
    deps.clock.set('2026-10-02T10:00:00.000Z');

    const updated = unwrap(await new UpdateHelpArticleUseCase(deps).execute({ id: moving.id, changes: { question: 'Nova?', topic: 'conta' } }));

    assert.deepEqual([updated.question, updated.answer, updated.topic, updated.position, updated.updated_at], ['Nova?', 'y', 'conta', 2, '2026-10-02T10:00:00.000Z']);
  });

  it('sobe e desce trocando com a vizinha do mesmo tema; na ponta, nada muda', async () => {
    const create = new CreateHelpArticleUseCase(deps);
    const a = await create.execute({ question: 'A?', answer: 'a', topic: 'trilhas' });
    const b = await create.execute({ question: 'B?', answer: 'b', topic: 'trilhas' });
    const move = new MoveHelpArticleUseCase(deps);

    unwrap(await move.execute({ id: b.id, direction: 'up' }));
    unwrap(await move.execute({ id: b.id, direction: 'up' }));

    assert.deepEqual((await new ListAllHelpUseCase(deps).execute()).map((x) => x.question), ['B?', 'A?']);
    assert.equal((await deps.helpArticles.findById(a.id))?.position, 2);
  });

  it('apagar some com a pergunta; id inexistente dá not_found', async () => {
    const article = await new CreateHelpArticleUseCase(deps).execute({ question: 'A?', answer: 'a', topic: 'conta' });
    const remove = new DeleteHelpArticleUseCase(deps);

    unwrap(await remove.execute({ id: article.id }));
    const again = await remove.execute({ id: article.id });
    const update = await new UpdateHelpArticleUseCase(deps).execute({ id: 99, changes: { answer: 'x' } });

    assert.deepEqual([again.ok ? 'ok' : again.kind, update.ok ? 'ok' : update.kind], ['not_found', 'not_found']);
  });
});
