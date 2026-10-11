import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { FARMER_ID, type ReviewsTestbed, givenCompletedService, givenFarm, givenWorker, reviewsTestbed } from '../testing/review-fixtures';
import { ListPendingReviewsUseCase } from './list-pending-reviews.usecase';
import { SubmitWorkerReviewUseCase } from './submit-review.usecase';

describe('ListPendingReviewsUseCase', () => {
  let t: ReviewsTestbed;
  let pending: ListPendingReviewsUseCase;

  beforeEach(() => {
    t = reviewsTestbed();
    pending = new ListPendingReviewsUseCase(t);
  });

  it('lista os serviços concluídos ainda no prazo, o que vence primeiro antes', async () => {
    const farm = await givenFarm(t, { photos: [{ id: 'a.webp', url: '/api/images/a.webp' }] });
    const maria = await givenWorker(t);
    const older = await givenCompletedService(t, farm, maria, '2026-09-25T15:00:00.000Z', { name: 'Plantio' });
    const newer = await givenCompletedService(t, farm, maria, '2026-09-29T15:00:00.000Z', { name: 'Colheita' });
    await givenCompletedService(t, farm, maria, '2026-09-01T15:00:00.000Z', { name: 'Vencido' });

    const forFarmer = await pending.forFarmer({ farmerId: FARMER_ID });
    const forWorker = await pending.forWorker({ workerId: maria.id });

    assert.deepEqual(forFarmer.map((p) => [p.service_id, p.subject]), [[older.id, 'Maria Silva'], [newer.id, 'Maria Silva']]);
    assert.deepEqual(forWorker.map((p) => [p.service_id, p.subject, p.photo_url]), [
      [older.id, 'Fazenda em Três Rios, RJ', '/api/images/a.webp'],
      [newer.id, 'Fazenda em Três Rios, RJ', '/api/images/a.webp']
    ]);
  });

  it('o que já foi avaliado sai da lista de quem avaliou e avisa o outro lado', async () => {
    const maria = await givenWorker(t);
    const service = await givenCompletedService(t, await givenFarm(t), maria);
    unwrap(await new SubmitWorkerReviewUseCase(t).execute({ serviceId: service.id, input: { punctuality: 5, effort: 5, quality: 5 } }));

    assert.deepEqual(await pending.forFarmer({ farmerId: FARMER_ID }), []);
    assert.deepEqual((await pending.forWorker({ workerId: maria.id })).map((p) => p.received_hidden), [true]);
  });
});
