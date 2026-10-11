import { type Result, invalid, ok } from '#shared/domain/result';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { DocumentParams, Handler, IdParams } from '#shared/infra/http/types';
import type { WorkerResponse } from '../worker.contract';
import type { WorkerUseCases } from '../workers.module';

// HTTP do currículo do trabalhador. Como nas fotos, o upload chega como o próprio arquivo no
// corpo (Content-Type application/pdf), lido pelo express.raw em app.ts.
export interface ResumeController {
  getDocument: Handler<Buffer, DocumentParams>;
  uploadWorkerResume: Handler<WorkerResponse, IdParams>;
  deleteWorkerResume: Handler<WorkerResponse, IdParams>;
}

const UPLOAD_HELP = 'Envie o currículo no corpo da requisição com Content-Type application/pdf.';

function readUpload(body: unknown): Result<Uint8Array> {
  return Buffer.isBuffer(body) && body.length > 0 ? ok(new Uint8Array(body)) : invalid(UPLOAD_HELP);
}

export function createResumeController(resumes: WorkerUseCases): ResumeController {
  // GET /api/documents/:id - Bytes do documento (PDF). O id é único por envio, então pode ficar em cache.
  const getDocument: Handler<Buffer, DocumentParams> = async (req, res) => {
    const result = await resumes.getDocument.execute({ documentId: req.params.id });
    if (!result.ok) { sendFailure(res, result); return; }
    res.setHeader('Content-Type', result.value.contentType);
    // Abre no visualizador do navegador; ao salvar, o nome sugerido é curriculo.pdf.
    res.setHeader('Content-Disposition', 'inline; filename="curriculo.pdf"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(Buffer.from(result.value.bytes));
  };

  // POST /api/workers/:id/resume - Envia (ou troca) o currículo do trabalhador
  const uploadWorkerResume: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const upload = readUpload(req.body);
    if (!upload.ok) { sendFailure(res, upload); return; }
    const result = await resumes.setWorkerResume.execute({ workerId: toId(req.params.id), upload: upload.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Resume updated.', worker: result.value });
  };

  // DELETE /api/workers/:id/resume - Remove o currículo do trabalhador
  const deleteWorkerResume: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const result = await resumes.removeWorkerResume.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Resume removed.', worker: result.value });
  };

  return { getDocument, uploadWorkerResume, deleteWorkerResume };
}
