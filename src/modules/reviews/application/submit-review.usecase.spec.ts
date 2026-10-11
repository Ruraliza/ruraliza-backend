import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { PAID_AT, type ReviewsTestbed, givenCompletedService, givenFarm, givenWorker, reviewsTestbed } from '../testing/review-fixtures';
import { GetReputationUseCase } from './get-reputation.usecase';
import { GetServiceReviewsUseCase } from './get-service-reviews.usecase';
import { SubmitFarmReviewUseCase, SubmitWorkerReviewUseCase } from './submit-review.usecase';

const WORKER_SCORES = { punctuality: 5, effort: 4, quality: 5, comment: 'Chegou cedo e caprichou.' };
const FARM_SCORES = { infrastructure: 4, conditions: 5, as_described: 5, comment: null };

describe('avaliação dupla', () => {
  let t: ReviewsTestbed;
  let reviewWorker: SubmitWorkerReviewUseCase;
  let reviewFarm: SubmitFarmReviewUseCase;
  let reviews: GetServiceReviewsUseCase;
  let reputation: GetReputationUseCase;

  beforeEach(() => {
    t = reviewsTestbed();
    reviewWorker = new SubmitWorkerReviewUseCase(t);
    reviewFarm = new SubmitFarmReviewUseCase(t);
    reviews = new GetServiceReviewsUseCase(t);
    reputation = new GetReputationUseCase(t);
  });

  it('é cega: a nota do produtor fica escondida até o trabalhador avaliar, e aí as duas aparecem', async () => {
    const farm = await givenFarm(t);
    const maria = await givenWorker(t);
    const service = await givenCompletedService(t, farm, maria);

    const afterFarmer = unwrap(await reviewWorker.execute({ serviceId: service.id, input: WORKER_SCORES }));
    assert.deepEqual([afterFarmer.can_review, afterFarmer.given?.punctuality, afterFarmer.received, afterFarmer.received_hidden], [false, 5, null, false]);

    const workerSees = unwrap(await reviews.forWorker({ serviceId: service.id, workerId: maria.id }));
    assert.deepEqual([workerSees.can_review, workerSees.received, workerSees.received_hidden], [true, null, true]);
    assert.equal((await reputation.forWorkers([maria.id])).get(maria.id)?.count, 0, 'ainda não entra na reputação');
    assert.equal(t.pushes.at(-1)?.message.title, 'Você foi avaliado');

    const afterWorker = unwrap(await reviewFarm.execute({ serviceId: service.id, input: { worker_id: maria.id, ...FARM_SCORES } }));
    assert.deepEqual([afterWorker.received?.punctuality, afterWorker.received?.comment, afterWorker.received_hidden], [5, 'Chegou cedo e caprichou.', false]);
    assert.equal('revealed' in (afterWorker.received ?? {}), false, 'campos internos não saem na resposta');

    const farmerSees = unwrap(await reviews.forFarmer({ serviceId: service.id }));
    assert.equal(farmerSees.received?.infrastructure, 4);
    assert.equal((await reputation.forWorkers([maria.id])).get(maria.id)?.average, 4.7);
    assert.equal((await reputation.forFarms([farm.id])).get(farm.id)?.average, 4.7);
    assert.equal(t.pushes.at(-1)?.message.title, 'Avaliações publicadas');
  });

  it('se só um lado avaliar, a nota aparece quando o prazo de 14 dias acaba', async () => {
    const farm = await givenFarm(t);
    const maria = await givenWorker(t);
    const service = await givenCompletedService(t, farm, maria);
    unwrap(await reviewWorker.execute({ serviceId: service.id, input: WORKER_SCORES }));

    t.setNow('2026-10-14T15:00:00.000Z');

    const workerSees = unwrap(await reviews.forWorker({ serviceId: service.id, workerId: maria.id }));
    assert.deepEqual([workerSees.can_review, workerSees.received?.effort, workerSees.received_hidden], [false, 4, false]);
    assert.equal((await reputation.forWorkers([maria.id])).get(maria.id)?.count, 1);
  });

  it('depois do prazo ninguém avalia mais', async () => {
    const service = await givenCompletedService(t, await givenFarm(t), await givenWorker(t));
    t.setNow('2026-10-15T00:00:00.000Z');

    const result = await reviewWorker.execute({ serviceId: service.id, input: WORKER_SCORES });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
  });

  it('cada lado avalia uma vez só', async () => {
    const service = await givenCompletedService(t, await givenFarm(t), await givenWorker(t));
    unwrap(await reviewWorker.execute({ serviceId: service.id, input: WORKER_SCORES }));

    const again = await reviewWorker.execute({ serviceId: service.id, input: WORKER_SCORES });

    assert.equal(again.ok ? 'ok' : again.kind, 'conflict');
  });

  it('serviço que não foi concluído não pode ser avaliado', async () => {
    const maria = await givenWorker(t);
    const service = await givenCompletedService(t, await givenFarm(t), maria, PAID_AT, { status: 'In Progress' });

    const result = await reviewFarm.execute({ serviceId: service.id, input: { worker_id: maria.id, ...FARM_SCORES } });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
  });

  it('só quem fez o serviço avalia a fazenda', async () => {
    const service = await givenCompletedService(t, await givenFarm(t), await givenWorker(t));

    const result = await reviewFarm.execute({ serviceId: service.id, input: { worker_id: 99, ...FARM_SCORES } });

    assert.equal(result.ok ? 'ok' : result.kind, 'forbidden');
  });

  it('a página do trabalhador traz as avaliações publicadas sem identificar quem escreveu', async () => {
    const farm = await givenFarm(t);
    const maria = await givenWorker(t);
    const service = await givenCompletedService(t, farm, maria);
    unwrap(await reviewWorker.execute({ serviceId: service.id, input: WORKER_SCORES }));
    unwrap(await reviewFarm.execute({ serviceId: service.id, input: { worker_id: maria.id, ...FARM_SCORES } }));

    const page = unwrap(await reputation.workerPage({ workerId: maria.id }));
    const farmPage = unwrap(await reputation.farmPage({ farmId: farm.id }));

    assert.deepEqual(page.reviews.map((r) => [r.author, r.service_name, r.comment]), [['Produtor em Três Rios, RJ', 'Colheita de café', 'Chegou cedo e caprichou.']]);
    assert.deepEqual(farmPage.reviews.map((r) => r.author), ['Maria']);
  });
});
