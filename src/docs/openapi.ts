import type { OpenAPIV3 } from 'openapi-types';
import { TAGS } from '#shared/infra/docs/operations';
import { BEARER_AUTH, type RouteGroup, toOpenApiPath } from '#shared/infra/http/route';
import { schemas } from './schemas';

const DESCRIPTION = `
API do **Ruraliza**: conecta produtores rurais a trabalhadores para serviços nas fazendas.

- Os dados (e as fotos e currículos) ficam **em memória** e somem quando o servidor reinicia. Ao subir, há dados de teste
  (produtor 1 com as fazendas 1 e 2, trabalhador 1, serviços 1 a 7: um por categoria, publicados em dias diferentes, com e sem prazo; o 7 já venceu).
- **Sessão**: \`POST /api/auth/login\` (produtor/trabalhador) e \`POST /api/auth/system/login\` (equipe) devolvem um \`token\`
  que vale 12 horas. As rotas com cadeado exigem \`Authorization: Bearer <token>\` (botão **Authorize**) e só deixam
  cada conta mexer no que é dela. As contas de teste usam a senha \`ruraliza123\`: \`produtor@exemplo.com\`,
  \`trabalhador@exemplo.com\`, \`ambos@exemplo.com\` e, na equipe, \`admin@exemplo.com\` e \`tutor@exemplo.com\`.
- **Usuários de sistema** (cargos \`admin\` e \`tutor\`) não se cadastram pelo app: um administrador cria em \`/api/admin/system-users\`.
- **Trilhas de estudo**: os tutores montam em \`/api/admin/tracks\`; os trabalhadores estudam em \`/api/workers/tracks\` e ganham um
  certificado, validado por qualquer pessoa em \`/api/certificates/{code}\` (com o resumo SHA-256 dos dados, \`data_hash\`).
  Trilhas nunca são removidas, só descontinuadas.
- Erros sempre em \`{ "error": "mensagem" }\`: 400 validação, 401 sem sessão (ou e-mail/senha incorretos), 403 sem permissão,
  404 não encontrado, 409 conflito de estado.
- Status em inglês: serviço \`Pending → In Progress → Completed\` (ou \`Cancelled\`); candidatura \`Pending → Accepted | Rejected\`.
- O JSON deste documento está em \`/api/docs/openapi.json\`.
`.trim();

const TAG_DESCRIPTIONS: Record<(typeof TAGS)[keyof typeof TAGS], string> = {
  [TAGS.system]: 'Estado do servidor.',
  [TAGS.auth]: 'Login e "esqueci a senha". A troca de senha com a conta aberta fica em Produtores e Trabalhadores.',
  [TAGS.categories]: 'Categorias fixas de serviço.',
  [TAGS.farmers]: 'Cadastro e perfil do produtor.',
  [TAGS.farms]: 'Fazendas do produtor (onde os serviços acontecem).',
  [TAGS.farmerServices]: 'Ciclo do serviço do lado do produtor: publicar, editar, cancelar, escolher o trabalhador e pagar.',
  [TAGS.workers]: 'Cadastro, perfil e acompanhamento do trabalhador.',
  [TAGS.jobs]: 'Vagas abertas (com filtros), candidatura e desistência.',
  [TAGS.images]: 'Fotos de perfil e de fazenda (WebP, no máximo 1000px).',
  [TAGS.documents]: 'Currículos dos trabalhadores (PDF, até 5 MB).',
  [TAGS.reviews]: 'Avaliação dupla depois do serviço concluído: o produtor avalia o trabalhador, o trabalhador avalia a fazenda. As notas só aparecem quando os dois avaliaram (ou o prazo acaba).',
  [TAGS.chat]: 'Conversa do serviço entre o produtor e o trabalhador aceito, com o WhatsApp protegido até os dois liberarem.',
  [TAGS.help]: 'Perguntas frequentes: a lista pública e a gestão pela equipe (criar, editar, ordenar e apagar).',
  [TAGS.moderation]: 'Denúncias de vagas e perfis e verificação de identidade: a equipe analisa e decide; quem pediu recebe o resultado.',
  [TAGS.sponsors]: 'Espaço de patrocínio: o cartão "Patrocinado" que aparece para produtores e trabalhadores, e a gestão pela equipe.',
  [TAGS.notifications]: 'Central de notificações de cada perfil: o histórico de tudo o que vira push (com ou sem push ativado), o contador de não lidas e o aviso em tempo real para o sino.',
  [TAGS.tracks]: 'Trilhas de estudo do lado dos tutores: criar, montar módulos e aulas, publicar e descontinuar (não há remoção).',
  [TAGS.learning]: 'Trilhas de estudo do lado do trabalhador: listar por categoria, começar, concluir aulas e certificados.',
  [TAGS.certificates]: 'Validação pública dos certificados de conclusão pelo código.',
  [TAGS.admin]: 'Gerenciamento das contas do app e da equipe, pelos usuários de sistema com cargo de administrador.'
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
    // Cada operação declara a sua (ver route() em src/shared/infra/http/route.ts).
    security: [],
    tags: Object.entries(TAG_DESCRIPTIONS).map(([name, description]) => ({ name, description })),
    paths,
    components: {
      schemas,
      securitySchemes: {
        [BEARER_AUTH]: { type: 'http', scheme: 'bearer', description: 'O `token` de POST /api/auth/login ou /api/auth/system/login.' }
      }
    }
  };
}
