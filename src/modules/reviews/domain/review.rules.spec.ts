import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WorkerReview } from '../reviews.contract';
import { isPublished, isWindowOpen, windowEndsAt, workerReputation } from './review.rules';

const review = (punctuality: number, effort: number, quality: number): WorkerReview => ({
  id: 1, service_id: 1, farmer_id: 1, worker_id: 1, punctuality, effort, quality, comment: null, insertion_date: '2026-01-01T00:00:00.000Z'
});

describe('regras das avaliações', () => {
  it('o prazo para avaliar é de 14 dias depois do pagamento', () => {
    const ends = windowEndsAt('2026-09-30T15:00:00.000Z');

    assert.equal(ends, '2026-10-14T15:00:00.000Z');
    assert.equal(isWindowOpen(ends, '2026-10-14T14:59:59.000Z'), true);
    assert.equal(isWindowOpen(ends, '2026-10-14T15:00:00.000Z'), false);
  });

  it('a avaliação só é publicada quando os dois avaliaram ou o prazo acabou', () => {
    const ends = '2026-10-14T15:00:00.000Z';

    assert.equal(isPublished({ window_ends_at: ends, revealed: false }, '2026-10-01T00:00:00.000Z'), false);
    assert.equal(isPublished({ window_ends_at: ends, revealed: true }, '2026-10-01T00:00:00.000Z'), true);
    assert.equal(isPublished({ window_ends_at: ends, revealed: false }, '2026-10-15T00:00:00.000Z'), true);
  });

  it('sem avaliações, a reputação fica vazia com a nota de ordenação no meio da escala', () => {
    assert.deepEqual(workerReputation([]), { average: null, count: 0, score: 3.5, punctuality: null, effort: null, quality: null });
  });

  it('a média geral é a média das avaliações, e cada critério tem a sua (uma casa decimal)', () => {
    const rep = workerReputation([review(5, 5, 4), review(4, 3, 4)]);

    assert.deepEqual([rep.average, rep.count, rep.punctuality, rep.effort, rep.quality], [4.2, 2, 4.5, 4, 4]);
  });

  it('a nota de ordenação pesa a quantidade: uma nota 5 sozinha fica atrás de várias notas 4,7', () => {
    const one = workerReputation([review(5, 5, 5)]);
    const many = workerReputation(Array.from({ length: 10 }, () => review(5, 5, 4)));

    assert.equal(one.average, 5);
    assert.equal(many.average, 4.7);
    assert.ok(many.score > one.score, `${many.score} deveria ser maior que ${one.score}`);
  });
});
