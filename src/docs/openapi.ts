import type { OpenAPIV3 } from 'openapi-types';
import { type RouteGroup, toOpenApiPath } from '../http/route';
import { TAGS } from './operations';
import { schemas } from './schemas';

const DESCRIPTION = `
API do **Ruraliza**: conecta produtores rurais a trabalhadores para serviços nas fazendas.

- Os dados (e as fotos) ficam **em memória** e somem quando o servidor reinicia. Ao subir, há dados de teste
  (produtor 1 com as fazendas 1 e 2, trabalhador 1, serviços 1 a 7: um por categoria, publicados em dias diferentes, com e sem prazo; o 7 já venceu).
- **Sem autenticação** nesta fase: quem age é informado no corpo (\`farmer_id\`, \`worker_id\`) ou na URL.
- Erros sempre em \`{ "error": "mensagem" }\`: 400 validação, 404 não encontrado, 409 conflito de estado.
- Status em inglês: serviço \`Pending → In Progress → Completed\` (ou \`Cancelled\`); candidatura \`Pending → Accepted | Rejected\`.
- O JSON deste documento está em \`/api/docs/openapi.json\`.
`.trim();

const TAG_DESCRIPTIONS: Record<(typeof TAGS)[keyof typeof TAGS], string> = {
  [TAGS.system]: 'Estado do servidor.',
  [TAGS.categories]: 'Categorias fixas de serviço.',
  [TAGS.farmers]: 'Cadastro e perfil do produtor.',
  [TAGS.farms]: 'Fazendas do produtor (onde os serviços acontecem).',
  [TAGS.farmerServices]: 'Ciclo do serviço do lado do produtor: publicar, editar, cancelar, escolher o trabalhador e pagar.',
  [TAGS.workers]: 'Cadastro, perfil e acompanhamento do trabalhador.',
  [TAGS.jobs]: 'Vagas abertas (com filtros), candidatura e desistência.',
  [TAGS.images]: 'Fotos de perfil e de fazenda (WebP, no máximo 1000px).'
};

export function buildOpenApiDocument(groups: readonly RouteGroup[]): OpenAPIV3.Document {
  const paths: OpenAPIV3.PathsObject = {};
  const operationIds = new Set<string>();

  for (const group of groups) {
    for (const r of group.routes) {
      const path = toOpenApiPath(group.prefix, r.path);
      const item: OpenAPIV3.PathItemObject = paths[path] ?? {};
      if (item[r.method] !== undefined) {
        throw new Error(`Rota duplicada na documentação: ${r.method.toUpperCase()} ${path}`);
      }
      const operationId = r.doc.operationId ?? '';
      if (operationIds.has(operationId)) {
        throw new Error(`operationId duplicado na documentação: ${operationId}`);
      }
      operationIds.add(operationId);
      item[r.method] = r.doc;
      paths[path] = item;
    }
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Ruraliza API', version: '1.0.0', description: DESCRIPTION, license: { name: 'ISC' } },
    servers: [{ url: '/', description: 'Este servidor' }],
    // Sem autenticação nesta fase (ver descrição).
    security: [],
    tags: Object.entries(TAG_DESCRIPTIONS).map(([name, description]) => ({ name, description })),
    paths,
    components: { schemas }
  };
}
