import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { invalid, ok } from '#shared/domain/result';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { adjustableClock } from '#shared/testing/recorders';
import { unwrap } from '#shared/testing/unwrap';
import { createInMemorySponsorRepository } from '../infra/in-memory-sponsor.repository';
import type { SponsorInput } from '../sponsor.contract';
import { CountSponsorClickUseCase } from './count-sponsor-click.usecase';
import { CreateSponsorUseCase } from './create-sponsor.usecase';
import { DeleteSponsorUseCase } from './delete-sponsor.usecase';
import { ServeSponsorSlotUseCase } from './serve-sponsor-slot.usecase';
import { SetSponsorImageUseCase } from './set-sponsor-image.usecase';
import type { SponsorDeps } from './sponsor-deps';
import { UpdateSponsorUseCase } from './update-sponsor.usecase';

const NOW = '2026-10-16T15:00:00.000Z';
const BASE: SponsorInput = { sponsor: 'Loja', title: 'Oferta', cta_label: 'Ver', url: 'https://exemplo.com.br', audience: 'all' };

describe('Patrocínios', () => {
  let deps: SponsorDeps & { clock: ReturnType<typeof adjustableClock> };
  let store: InMemoryImageStore;
  let create: CreateSponsorUseCase;
  let serve: ServeSponsorSlotUseCase;

  beforeEach(() => {
    store = new InMemoryImageStore();
    deps = {
      sponsors: createInMemorySponsorRepository(),
      images: {
        processor: { normalize: (input) => Promise.resolve(input.length > 1 ? ok({ bytes: input, contentType: 'image/webp', width: 10, height: 10 }) : invalid('Não é imagem.')) },
        store
      },
      clock: adjustableClock(NOW)
    };
    create = new CreateSponsorUseCase(deps);
    serve = new ServeSponsorSlotUseCase(deps);
  });

  it('reveza os patrocínios que servem (quem menos apareceu primeiro) e conta cada aparição', async () => {
    const a = unwrap(await create.execute({ ...BASE, sponsor: 'A' }));
    const b = unwrap(await create.execute({ ...BASE, sponsor: 'B' }));

    const shown = [];
    for (let i = 0; i < 4; i++) shown.push((await serve.execute({ audience: 'farmer', state: null, categories: [] }))?.sponsor);

    assert.deepEqual(shown, ['A', 'B', 'A', 'B']);
    assert.deepEqual([(await deps.sponsors.findById(a.id))?.impressions, (await deps.sponsors.findById(b.id))?.impressions], [2, 2]);
  });

  it('respeita o público, o período, a UF e os interesses do trabalhador', async () => {
    unwrap(await create.execute({ ...BASE, sponsor: 'Só produtor', audience: 'farmer' }));
    unwrap(await create.execute({ ...BASE, sponsor: 'Só RJ', states: ['RJ'] }));
    unwrap(await create.execute({ ...BASE, sponsor: 'Só colheita', audience: 'worker', categories: ['Colheita'] }));
    unwrap(await create.execute({ ...BASE, sponsor: 'Acabou', ends_on: '2026-10-15' }));
    unwrap(await create.execute({ ...BASE, sponsor: 'Desligado', active: false }));

    const seen = async (audience: 'farmer' | 'worker', state: string | null, categories: string[]): Promise<string[]> => {
      const names = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const card = await serve.execute({ audience, state, categories });
        if (card) names.add(card.sponsor);
      }
      return [...names].sort();
    };

    assert.deepEqual(await seen('farmer', 'RJ', []), ['Só RJ', 'Só produtor']);
    assert.deepEqual(await seen('farmer', 'MG', []), ['Só produtor']);
    assert.deepEqual(await seen('worker', null, ['Plantio']), []);
    assert.deepEqual(await seen('worker', null, ['Colheita']), ['Só colheita']);
    assert.deepEqual(await seen('worker', null, []), ['Só colheita']); // sem interesses conhecidos, não exclui
  });

  it('conta o clique, edita sem perder os números e não aceita período fora de ordem', async () => {
    const sponsor = unwrap(await create.execute(BASE));
    unwrap(await new CountSponsorClickUseCase(deps).execute({ id: sponsor.id }));
    deps.clock.set('2026-10-17T10:00:00.000Z');

    const updated = unwrap(await new UpdateSponsorUseCase(deps).execute({ id: sponsor.id, changes: { title: 'Nova oferta' } }));
    const wrong = await new UpdateSponsorUseCase(deps).execute({ id: sponsor.id, changes: { starts_on: '2026-11-10', ends_on: '2026-11-01' } });

    assert.deepEqual([updated.title, updated.clicks, updated.updated_at], ['Nova oferta', 1, '2026-10-17T10:00:00.000Z']);
    assert.equal(wrong.ok ? '' : wrong.kind, 'invalid');
  });

  it('a logo troca a anterior e sai junto quando o patrocínio é apagado', async () => {
    const sponsor = unwrap(await create.execute(BASE));
    const setImage = new SetSponsorImageUseCase(deps);
    const first = unwrap(await setImage.execute({ id: sponsor.id, upload: new Uint8Array([1, 2]) }));
    const second = unwrap(await setImage.execute({ id: sponsor.id, upload: new Uint8Array([3, 4]) }));
    const idOf = (url: string | null): string => store.idFromUrl(url ?? '') ?? '';

    assert.equal(await store.get(idOf(first.image_url)), undefined);
    unwrap(await new DeleteSponsorUseCase(deps).execute({ id: sponsor.id }));
    assert.equal(await store.get(idOf(second.image_url)), undefined);
  });
});
