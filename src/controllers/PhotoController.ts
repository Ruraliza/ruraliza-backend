import type { FarmResponse, FarmerResponse, WorkerResponse } from '../contracts';
import { type Result, invalid, ok } from '../domain/result';
import { sendFailure, toId } from '../http/respond';
import type { FarmParams, FarmPhotoParams, Handler, IdParams, ImageParams } from '../http/types';
import type { PhotoUseCases } from '../usecases/PhotoUseCases';

// HTTP das fotos. O upload chega como o próprio arquivo no corpo (Content-Type image/*),
// lido pelo express.raw em app.ts. Sem multipart: um arquivo por requisição.
export interface PhotoController {
  getImage: Handler<Buffer, ImageParams>;
  uploadFarmerPhoto: Handler<FarmerResponse, IdParams>;
  deleteFarmerPhoto: Handler<FarmerResponse, IdParams>;
  uploadWorkerPhoto: Handler<WorkerResponse, IdParams>;
  deleteWorkerPhoto: Handler<WorkerResponse, IdParams>;
  addFarmPhoto: Handler<FarmResponse, FarmParams>;
  deleteFarmPhoto: Handler<FarmResponse, FarmPhotoParams>;
}

const UPLOAD_HELP = 'Envie a foto no corpo da requisição com Content-Type image/jpeg, image/png, image/webp ou image/avif.';

function readUpload(body: unknown): Result<Uint8Array> {
  return Buffer.isBuffer(body) && body.length > 0 ? ok(new Uint8Array(body)) : invalid(UPLOAD_HELP);
}

export function createPhotoController(photos: PhotoUseCases): PhotoController {
  // GET /api/images/:id - Bytes da imagem (WebP). O id é único por envio, então pode ficar em cache.
  const getImage: Handler<Buffer, ImageParams> = async (req, res) => {
    const result = await photos.getImage(req.params.id);
    if (!result.ok) { sendFailure(res, result); return; }
    res.setHeader('Content-Type', result.value.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(Buffer.from(result.value.bytes));
  };

  // POST /api/farmers/:id/photo - Envia (ou troca) a foto de perfil do produtor
  const uploadFarmerPhoto: Handler<FarmerResponse, IdParams> = async (req, res) => {
    const upload = readUpload(req.body);
    if (!upload.ok) { sendFailure(res, upload); return; }
    const result = await photos.setFarmerPhoto(toId(req.params.id), upload.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Profile photo updated.', farmer: result.value });
  };

  // DELETE /api/farmers/:id/photo - Remove a foto de perfil do produtor
  const deleteFarmerPhoto: Handler<FarmerResponse, IdParams> = async (req, res) => {
    const result = await photos.removeFarmerPhoto(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Profile photo removed.', farmer: result.value });
  };

  // POST /api/workers/:id/photo - Envia (ou troca) a foto de perfil do trabalhador
  const uploadWorkerPhoto: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const upload = readUpload(req.body);
    if (!upload.ok) { sendFailure(res, upload); return; }
    const result = await photos.setWorkerPhoto(toId(req.params.id), upload.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Profile photo updated.', worker: result.value });
  };

  // DELETE /api/workers/:id/photo - Remove a foto de perfil do trabalhador
  const deleteWorkerPhoto: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const result = await photos.removeWorkerPhoto(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Profile photo removed.', worker: result.value });
  };

  // POST /api/farmers/:id/farms/:farmId/photos - Adiciona uma foto à fazenda
  const addFarmPhoto: Handler<FarmResponse, FarmParams> = async (req, res) => {
    const upload = readUpload(req.body);
    if (!upload.ok) { sendFailure(res, upload); return; }
    const result = await photos.addFarmPhoto(toId(req.params.id), toId(req.params.farmId), upload.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Farm photo added.', farm: result.value });
  };

  // DELETE /api/farmers/:id/farms/:farmId/photos/:photoId - Remove uma foto da fazenda
  const deleteFarmPhoto: Handler<FarmResponse, FarmPhotoParams> = async (req, res) => {
    const result = await photos.removeFarmPhoto(toId(req.params.id), toId(req.params.farmId), req.params.photoId);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Farm photo removed.', farm: result.value });
  };

  return { getImage, uploadFarmerPhoto, deleteFarmerPhoto, uploadWorkerPhoto, deleteWorkerPhoto, addFarmPhoto, deleteFarmPhoto };
}
