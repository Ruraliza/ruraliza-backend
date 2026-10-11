import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type ServicesTestbed, givenFarm, givenFarmer, givenService, servicesTestbed } from '../testing/service-fixtures';
import { GetOpenServiceUseCase } from './get-open-service.usecase';

const PHOTO = { id: 'a.webp', url: '/api/images/a.webp' };

describe('GetOpenServiceUseCase', () => {
  let t: ServicesTestbed;
  let getOpen: GetOpenServiceUseCase;

  beforeEach(() => {
    t = servicesTestbed();
    getOpen = new GetOpenServiceUseCase(t);
  });

  it('mostra cidade/UF e fotos, sem endereço nem ponto no mapa', async () => {
    const farm = await givenFarm(t, await givenFarmer(t), { photos: [PHOTO] });
    const service = await givenService(t, farm);

    const job = unwrap(await getOpen.execute({ serviceId: service.id, viewerWorkerId: 7 }));

    assert.deepEqual(job, { ...service, farm: { city: 'Três Rios', state: 'RJ', photos: [PHOTO.url] } });
  });

  it('só o trabalhador aceito recebe o ponto no mapa', async () => {
    const farm = await givenFarm(t, await givenFarmer(t));
    const service = await givenService(t, farm, { status: 'In Progress', worker_id: 7 });

    const accepted = unwrap(await getOpen.execute({ serviceId: service.id, viewerWorkerId: 7 }));
    assert.deepEqual([accepted.farm.latitude, accepted.farm.longitude], [-22.1165, -43.2092]);

    const other = unwrap(await getOpen.execute({ serviceId: service.id, viewerWorkerId: 8 }));
    assert.equal('latitude' in other.farm, false);
    const anonymous = unwrap(await getOpen.execute({ serviceId: service.id }));
    assert.equal('latitude' in anonymous.farm, false);
  });

  it('fazenda sem ponto marcado não expõe coordenadas nem ao aceito', async () => {
    const farm = await givenFarm(t, await givenFarmer(t), { latitude: null, longitude: null });
    const service = await givenService(t, farm, { status: 'In Progress', worker_id: 7 });

    const job = unwrap(await getOpen.execute({ serviceId: service.id, viewerWorkerId: 7 }));

    assert.equal('latitude' in job.farm, false);
  });

  it('serviço inexistente dá not_found', async () => {
    const result = await getOpen.execute({ serviceId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
