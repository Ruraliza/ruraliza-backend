// Fotos (com o processamento de verdade, via Sharp) e currículos.
// Testes de integração: os módulos juntos pelo container, sem HTTP (as regras de cada caso de uso
// estão nos specs ao lado do código, em src/modules/*/application).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { farmerWithFarm, openService, setup, unwrap, worker } from './support';

describe('Fotos', () => {
  const PNG = async (): Promise<Uint8Array> => {
    const sharp = (await import('sharp')).default;
    return new Uint8Array(await sharp({ create: { width: 20, height: 20, channels: 3, background: '#00552a' } }).png().toBuffer());
  };

  it('remover o produtor apaga do store a foto de perfil e as fotos das fazendas', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const farmer = unwrap(await c.useCases.photos.setFarmerPhoto.execute({ farmerId: farmerId, upload: await PNG() }));
    const farm = unwrap(await c.useCases.photos.addFarmPhoto.execute({ farmerId: farmerId, farmId: farmId, upload: await PNG() }));
    const ids = [c.images.idFromUrl(farmer.photo_url ?? ''), farm.photos[0]?.id].filter((id): id is string => id !== undefined);
    assert.equal(ids.length, 2);

    unwrap(await c.useCases.farmers.deleteFarmer.execute({ farmerId: farmerId }));
    for (const id of ids) assert.equal(await c.images.get(id), undefined);
  });

  it('foto de perfil sai quadrada (quadrado central, até 1000px); foto da fazenda mantém a proporção', async () => {
    const sharp = (await import('sharp')).default;
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const wide = new Uint8Array(await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7d24' } }).jpeg().toBuffer());
    const small = new Uint8Array(await sharp({ create: { width: 300, height: 400, channels: 3, background: '#ee8a14' } }).png().toBuffer());
    const sizeOf = async (url: string | null | undefined): Promise<[number | undefined, number | undefined]> => {
      const image = await c.images.get(c.images.idFromUrl(url ?? '') ?? '');
      assert.ok(image);
      const { width, height } = await sharp(image.bytes).metadata();
      return [width, height];
    };

    assert.deepEqual(await sizeOf(unwrap(await c.useCases.photos.setFarmerPhoto.execute({ farmerId: farmerId, upload: wide })).photo_url), [1000, 1000]);
    assert.deepEqual(await sizeOf(unwrap(await c.useCases.photos.setFarmerPhoto.execute({ farmerId: farmerId, upload: small })).photo_url), [300, 300]);
    assert.deepEqual(await sizeOf(unwrap(await c.useCases.photos.addFarmPhoto.execute({ farmerId: farmerId, farmId: farmId, upload: wide })).photos[0]?.url), [1000, 667]);
  });

  it('recusa bytes que não são imagem', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const result = await c.useCases.photos.setWorkerPhoto.execute({ workerId: w, upload: new TextEncoder().encode('texto') });
    assert.equal(result.ok ? '' : result.kind, 'invalid');
    assert.equal((await c.repos.workers.findById(w))?.photo_url, null);
  });
});
describe('Currículo', () => {
  const PDF = (): Uint8Array => new TextEncoder().encode('%PDF-1.4\n%%EOF\n');

  it('guarda o PDF como veio, troca apagando o anterior e some ao remover o trabalhador', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const first = unwrap(await c.useCases.workers.setWorkerResume.execute({ workerId: w, upload: PDF() })).resume_url;
    assert.match(first ?? '', /^\/api\/documents\/.+\.pdf$/);
    const firstId = c.documents.idFromUrl(first ?? '') ?? '';
    assert.deepEqual((await c.documents.get(firstId))?.bytes, PDF());

    const second = unwrap(await c.useCases.workers.setWorkerResume.execute({ workerId: w, upload: PDF() })).resume_url;
    assert.notEqual(second, first);
    assert.equal(await c.documents.get(firstId), undefined);

    unwrap(await c.useCases.workers.deleteWorker.execute({ workerId: w }));
    assert.equal(await c.documents.get(c.documents.idFromUrl(second ?? '') ?? ''), undefined);
  });

  it('o produtor vê o currículo de quem se candidatou ao serviço', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const url = unwrap(await c.useCases.workers.setWorkerResume.execute({ workerId: w, upload: PDF() })).resume_url;
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));

    const [application] = unwrap(await c.useCases.hiring.listServiceApplications.execute({ serviceId: serviceId }));
    assert.equal(application?.worker.resume_url, url);
  });

  it('recusa arquivo que não é PDF', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const result = await c.useCases.workers.setWorkerResume.execute({ workerId: w, upload: new TextEncoder().encode('texto') });
    assert.equal(result.ok ? '' : result.kind, 'invalid');
    assert.equal((await c.repos.workers.findById(w))?.resume_url, null);
  });
});
