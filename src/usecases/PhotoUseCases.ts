import type { Farm, FarmPhoto, Farmer, Worker } from '../contracts';
import { type ImageProcessor, type ImageStore, MAX_FARM_PHOTOS, type StoredImage } from '../domain/images';
import type { FarmRepository, FarmerRepository, WorkerRepository } from '../domain/repositories';
import { type Result, conflict, notFound, ok } from '../domain/result';
import { findActiveFarm } from './shared';

// Fotos de perfil (produtor e trabalhador) e da fazenda. Toda imagem passa pelo ImageProcessor
// (≤ 1000px, WebP, sem metadados) antes de ir para o ImageStore; a entidade guarda só a URL.
export class PhotoUseCases {
  constructor(
    private readonly repos: { farmers: FarmerRepository; workers: WorkerRepository; farms: FarmRepository },
    private readonly images: { processor: ImageProcessor; store: ImageStore }
  ) {}

  // Bytes para GET /api/images/:id.
  async getImage(id: string): Promise<Result<StoredImage>> {
    const image = await this.images.store.get(id);
    return image ? ok(image) : notFound('Imagem não encontrada.');
  }

  // --- Perfis (uma foto; enviar de novo substitui) ---

  async setFarmerPhoto(farmerId: number, upload: Uint8Array): Promise<Result<Farmer>> {
    const farmer = await this.repos.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const url = await this.store(upload);
    if (!url.ok) return url;
    await releaseImage(this.images.store, farmer.photo_url);
    farmer.photo_url = url.value;
    await this.repos.farmers.update(farmer);
    return ok(farmer);
  }

  async removeFarmerPhoto(farmerId: number): Promise<Result<Farmer>> {
    const farmer = await this.repos.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    await releaseImage(this.images.store, farmer.photo_url);
    farmer.photo_url = null;
    await this.repos.farmers.update(farmer);
    return ok(farmer);
  }

  async setWorkerPhoto(workerId: number, upload: Uint8Array): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const url = await this.store(upload);
    if (!url.ok) return url;
    await releaseImage(this.images.store, worker.photo_url);
    worker.photo_url = url.value;
    await this.repos.workers.update(worker);
    return ok(worker);
  }

  async removeWorkerPhoto(workerId: number): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    await releaseImage(this.images.store, worker.photo_url);
    worker.photo_url = null;
    await this.repos.workers.update(worker);
    return ok(worker);
  }

  // --- Fazenda (várias fotos; a primeira é a capa) ---

  async addFarmPhoto(farmerId: number, farmId: number, upload: Uint8Array): Promise<Result<Farm>> {
    const farm = await this.findOwnFarm(farmerId, farmId);
    if (!farm.ok) return farm;
    if (farm.value.photos.length >= MAX_FARM_PHOTOS) {
      return conflict(`A fazenda já tem ${MAX_FARM_PHOTOS} fotos. Remova uma antes de enviar outra.`);
    }

    const processed = await this.images.processor.normalize(upload);
    if (!processed.ok) return processed;
    const id = await this.images.store.save(processed.value);
    farm.value.photos.push({ id, url: this.images.store.urlFor(id) });
    await this.repos.farms.update(farm.value);
    return ok(farm.value);
  }

  async removeFarmPhoto(farmerId: number, farmId: number, photoId: string): Promise<Result<Farm>> {
    const farm = await this.findOwnFarm(farmerId, farmId);
    if (!farm.ok) return farm;

    const photo = farm.value.photos.find((p: FarmPhoto) => p.id === photoId);
    if (!photo) return notFound('Foto não encontrada nesta fazenda.');

    await this.images.store.delete(photo.id);
    farm.value.photos = farm.value.photos.filter((p) => p.id !== photoId);
    await this.repos.farms.update(farm.value);
    return ok(farm.value);
  }

  private async store(upload: Uint8Array): Promise<Result<string>> {
    const processed = await this.images.processor.normalize(upload);
    if (!processed.ok) return processed;
    const id = await this.images.store.save(processed.value);
    return ok(this.images.store.urlFor(id));
  }

  private async findOwnFarm(farmerId: number, farmId: number): Promise<Result<Farm>> {
    const farmer = await this.repos.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');
    const farm = await findActiveFarm(this.repos.farms, farmId);
    if (!farm || farm.farmer_id !== farmer.id) return notFound('Fazenda não encontrada.');
    return ok(farm);
  }
}

// Apaga do store a imagem de uma URL gerada por ele (sem erro se não houver).
export async function releaseImage(store: ImageStore, url: string | null): Promise<void> {
  if (url === null) return;
  const id = store.idFromUrl(url);
  if (id !== undefined) await store.delete(id);
}
