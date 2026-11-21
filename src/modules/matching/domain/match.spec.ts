import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type JobFacts, type WorkerInterests, distanceBand, matchJob, matchWorker } from './match';

const TRES_RIOS = { latitude: -22.12, longitude: -43.21 };
const job = (changes: Partial<JobFacts> = {}): JobFacts => ({
  category: 'Colheita', latitude: -22.1165, longitude: -43.2092, reputation: undefined, farmerVerified: false, ...changes
});
const interests = (changes: Partial<WorkerInterests> = {}): WorkerInterests => ({
  chosen: new Set(), tracks: new Map(), history: new Set(), near: null, ...changes
});

describe('matchJob', () => {
  it('a categoria escolhida e a trilha concluída somam, cada uma com o seu motivo', () => {
    const match = matchJob(
      interests({ chosen: new Set(['Colheita']), tracks: new Map([['Colheita', { title: 'Colheita do café', completed: true }]]) }),
      job()
    );

    assert.deepEqual(match?.reasons, ['Você escolheu Colheita', 'Você concluiu a trilha Colheita do café']);
    assert.equal(match.explicit, true);
  });

  it('com alguma categoria conhecida, vaga de outra categoria não entra', () => {
    assert.equal(matchJob(interests({ chosen: new Set(['Plantio']) }), job()), null);
    assert.equal(matchJob(interests(), job()), null); // sem nada: não há o que sugerir
  });

  it('só o histórico sugere, mas não vale para avisar na hora', () => {
    const match = matchJob(interests({ history: new Set(['Colheita']) }), job());

    assert.deepEqual([match?.reasons, match?.explicit], [['Parecida com vagas em que você se candidatou'], false]);
  });

  it('perto de mim: fora do raio nunca entra; dentro, diz a distância e pesa mais quanto mais perto', () => {
    const near = { ...TRES_RIOS, radius_km: 30 };
    const far = job({ latitude: -22.505, longitude: -43.1789 }); // ~43 km

    assert.equal(matchJob(interests({ chosen: new Set(['Colheita']), near }), far), null);
    const close = matchJob(interests({ near }), job());
    assert.deepEqual([close?.distanceKm, close?.reasons, close?.explicit], [0, ['Pertinho de você'], true]);
  });

  it('fazenda bem avaliada e produtor verificado ajudam', () => {
    const reputation = { average: 4.8, count: 3, score: 4.6, infrastructure: 5, conditions: 4.7, as_described: 4.7 };
    const match = matchJob(interests({ chosen: new Set(['Colheita']) }), job({ reputation, farmerVerified: true }));

    assert.deepEqual(match?.reasons, ['Você escolheu Colheita', 'Fazenda bem avaliada', 'Produtor verificado']);
    assert.equal(match.score, 4);
  });

  it('no sentido inverso (catálogo), exige a categoria escolhida e fala com o produtor', () => {
    const reputation = { average: 4.8, count: 3, score: 4.6, punctuality: 5, effort: 4.7, quality: 4.7 };
    const tracks = new Map([['Colheita', { title: 'Colheita do café', completed: true }]]);
    const worker = interests({ chosen: new Set(['Colheita']), tracks, history: new Set(['Colheita']), near: { ...TRES_RIOS, radius_km: 30 } });
    const far = { category: 'Colheita', latitude: -22.2, longitude: -43.21 }; // ~9 km

    const match = matchWorker(worker, far, { reputation, verified: true });

    assert.deepEqual(match?.reasons, [
      'Escolheu Colheita', 'Concluiu a trilha Colheita do café', 'Já se candidatou a vagas de Colheita', 'De 5 a 15 km da fazenda', 'Nota 4,8', 'Verificado'
    ]);
    assert.equal(matchWorker(interests({ tracks }), far, { reputation: undefined, verified: false }), null); // só a trilha não basta
    assert.equal(matchWorker({ ...worker, near: { ...TRES_RIOS, radius_km: 5 } }, far, { reputation: undefined, verified: false }), null); // fora do raio
  });

  it('no catálogo, a distância sai só em faixas', () => {
    assert.deepEqual([0, 5, 6, 15, 29, 30, 31, 60, 61, 200].map((km) => distanceBand(km).label), [
      'Até 5 km da fazenda', 'Até 5 km da fazenda', 'De 5 a 15 km da fazenda', 'De 5 a 15 km da fazenda', 'De 15 a 30 km da fazenda',
      'De 15 a 30 km da fazenda', 'De 30 a 60 km da fazenda', 'De 30 a 60 km da fazenda', 'Mais de 60 km da fazenda', 'Mais de 60 km da fazenda'
    ]);
  });
});
