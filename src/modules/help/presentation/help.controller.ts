import type { MessageResponse } from '#shared/contracts/api';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { HelpArticle, HelpArticleResponse } from '../help.contract';
import type { HelpUseCases } from '../help.module';
import { parseHelpArticleInput, parseHelpArticleMove, parseHelpArticleUpdate } from './help.parsers';

// HTTP da central de ajuda: a lista pública e a gestão pela equipe.
export interface HelpController {
  listHelp: Handler<HelpArticle[]>;
  listHelpAdmin: Handler<HelpArticle[]>;
  createHelpArticle: Handler<HelpArticleResponse>;
  updateHelpArticle: Handler<HelpArticleResponse, IdParams>;
  moveHelpArticle: Handler<HelpArticleResponse, IdParams>;
  deleteHelpArticle: Handler<MessageResponse, IdParams>;
}

export function createHelpController(help: HelpUseCases): HelpController {
  // GET /api/help - Perguntas publicadas, por tema
  const listHelp: Handler<HelpArticle[]> = async (_req, res) => {
    res.status(200).json(await help.listPublished.execute());
  };

  // GET /api/admin/help - Todas as perguntas, inclusive rascunhos
  const listHelpAdmin: Handler<HelpArticle[]> = async (_req, res) => {
    res.status(200).json(await help.listAll.execute());
  };

  // POST /api/admin/help - Pergunta nova (no fim do tema)
  const createHelpArticle: Handler<HelpArticleResponse> = async (req, res) => {
    const input = parseHelpArticleInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    res.status(201).json({ message: 'Help article created successfully!', article: await help.create.execute(input.value) });
  };

  // PATCH /api/admin/help/:id - Edita a pergunta
  const updateHelpArticle: Handler<HelpArticleResponse, IdParams> = async (req, res) => {
    const changes = parseHelpArticleUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }
    const result = await help.update.execute({ id: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Help article updated successfully!', article: result.value });
  };

  // PATCH /api/admin/help/:id/move - Sobe ou desce no tema
  const moveHelpArticle: Handler<HelpArticleResponse, IdParams> = async (req, res) => {
    const input = parseHelpArticleMove(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await help.move.execute({ id: toId(req.params.id), direction: input.value.direction });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Help article moved successfully!', article: result.value });
  };

  // DELETE /api/admin/help/:id - Apaga a pergunta
  const deleteHelpArticle: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await help.remove.execute({ id: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Help article deleted successfully!' });
  };

  return { listHelp, listHelpAdmin, createHelpArticle, updateHelpArticle, moveHelpArticle, deleteHelpArticle };
}
