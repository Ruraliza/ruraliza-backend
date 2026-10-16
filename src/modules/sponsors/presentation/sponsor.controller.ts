import type { MessageResponse } from '#shared/contracts/api';
import { invalid } from '#shared/domain/result';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { Sponsor, SponsorResponse, SponsorSlotResponse } from '../sponsor.contract';
import type { SponsorUseCases } from '../sponsors.module';
import { parseSlotQuery, parseSponsorInput, parseSponsorUpdate } from './sponsor.parsers';

// HTTP dos patrocínios: o cartão da vez e o clique (públicos) e a gestão pela equipe.
export interface SponsorController {
  sponsorSlot: Handler<SponsorSlotResponse>;
  sponsorClick: Handler<MessageResponse, IdParams>;
  listSponsors: Handler<Sponsor[]>;
  createSponsor: Handler<SponsorResponse>;
  updateSponsor: Handler<SponsorResponse, IdParams>;
  deleteSponsor: Handler<MessageResponse, IdParams>;
  uploadSponsorImage: Handler<SponsorResponse, IdParams>;
  deleteSponsorImage: Handler<SponsorResponse, IdParams>;
}

const UPLOAD_HELP = 'Envie a imagem no corpo da requisição com Content-Type image/jpeg, image/png, image/webp ou image/avif.';

export function createSponsorController(sponsors: SponsorUseCases): SponsorController {
  // GET /api/sponsors/slot?audience=&state=&categories= - O patrocínio da vez (conta a aparição)
  const sponsorSlot: Handler<SponsorSlotResponse> = async (req, res) => {
    const query = parseSlotQuery(req.query);
    if (!query.ok) { sendFailure(res, query); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ card: await sponsors.serve.execute(query.value) });
  };

  // POST /api/sponsors/:id/click - Alguém abriu o link
  const sponsorClick: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await sponsors.click.execute({ id: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Click counted.' });
  };

  // GET /api/admin/sponsors - Todos os patrocínios, com os números
  const listSponsors: Handler<Sponsor[]> = async (_req, res) => {
    res.status(200).json(await sponsors.list.execute());
  };

  // POST /api/admin/sponsors - Patrocínio novo
  const createSponsor: Handler<SponsorResponse> = async (req, res) => {
    const input = parseSponsorInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await sponsors.create.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Sponsor created.', sponsor: result.value });
  };

  // PATCH /api/admin/sponsors/:id - Edita
  const updateSponsor: Handler<SponsorResponse, IdParams> = async (req, res) => {
    const changes = parseSponsorUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }
    const result = await sponsors.update.execute({ id: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Sponsor updated.', sponsor: result.value });
  };

  // DELETE /api/admin/sponsors/:id - Apaga
  const deleteSponsor: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await sponsors.remove.execute({ id: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Sponsor deleted.' });
  };

  // POST /api/admin/sponsors/:id/image - Logo ou foto
  const uploadSponsorImage: Handler<SponsorResponse, IdParams> = async (req, res) => {
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) { sendFailure(res, invalid(UPLOAD_HELP)); return; }
    const result = await sponsors.setImage.execute({ id: toId(req.params.id), upload: new Uint8Array(body) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Sponsor image updated.', sponsor: result.value });
  };

  // DELETE /api/admin/sponsors/:id/image - Tira a imagem
  const deleteSponsorImage: Handler<SponsorResponse, IdParams> = async (req, res) => {
    const result = await sponsors.removeImage.execute({ id: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Sponsor image removed.', sponsor: result.value });
  };

  return { sponsorSlot, sponsorClick, listSponsors, createSponsor, updateSponsor, deleteSponsor, uploadSponsorImage, deleteSponsorImage };
}
