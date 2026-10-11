import type { ResumeController } from '../controllers/ResumeController';
import { TAGS, operation } from '../docs/operations';
import { PUBLIC_ROUTE } from '../http/access';
import { type RouteDef, route } from '#shared/infra/http/route';

// Montadas em /api/documents.
export function documentRoutes(resumes: ResumeController): readonly RouteDef[] {
  return [
    route('get', '/:id', resumes.getDocument, operation({
      tag: TAGS.documents,
      summary: 'Baixar documento',
      description:
        'Currículos em PDF dos trabalhadores, guardados como foram enviados. A URL vem pronta no trabalhador ' +
        '(`resume_url`). Cada envio gera um id novo, então a resposta pode ficar em cache para sempre.',
      params: [{ name: 'id', in: 'path', required: true, description: 'Id do documento (ex.: `3f2c….pdf`).', schema: { type: 'string' } }],
      success: { status: 200, description: 'Bytes do PDF.', binary: 'application/pdf' },
      errors: { 404: 'Documento não encontrado.' }
    }), PUBLIC_ROUTE)
  ];
}
