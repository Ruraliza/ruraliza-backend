import { type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { ANSWER_MAX_LENGTH, HELP_TOPICS, QUESTION_MAX_LENGTH } from '../domain/help-article';

// Schemas OpenAPI da central de ajuda (contrato em ../help.contract.ts). Registrados em src/docs/schemas.ts.
export type HelpSchemaName = 'HelpTopic' | 'HelpArticle' | 'HelpArticleInput' | 'HelpArticleUpdate' | 'HelpArticleMoveInput' | 'HelpArticleResponse';

const ref: RefTo<HelpSchemaName> = refTo;

const question: Schema = { type: 'string', maxLength: QUESTION_MAX_LENGTH, example: 'Quanto custa?' };
const answer: Schema = {
  type: 'string', maxLength: ANSWER_MAX_LENGTH, example: 'Nesta fase de testes, nada.', description: 'Texto simples; quebras de linha viram parágrafos.'
};
const published: Schema = { type: 'boolean', example: true, description: 'Rascunho (false) não aparece na central pública.' };

export const helpSchemas = {
  HelpTopic: {
    type: 'string', enum: [...HELP_TOPICS], example: 'pagamentos',
    description: 'Tema, na ordem da tela: começar, produtores, trabalhadores, pagamentos, segurança, trilhas, conta.'
  },
  HelpArticle: object(
    { id, question, answer, topic: ref('HelpTopic'), position: { type: 'integer', minimum: 1, example: 1 }, published, updated_at: isoDate },
    ['id', 'question', 'answer', 'topic', 'position', 'published', 'updated_at'],
    'Pergunta da central de ajuda.'
  ),
  HelpArticleInput: input({ question, answer, topic: ref('HelpTopic'), published }, ['question', 'answer', 'topic'], 'Pergunta nova; entra no fim do tema.'),
  HelpArticleUpdate: input({ question, answer, topic: ref('HelpTopic'), published }, [], 'Só o que mudou (ao menos um campo). Mudou de tema: vai para o fim do tema novo.'),
  HelpArticleMoveInput: input({ direction: { type: 'string', enum: ['up', 'down'], example: 'up' } }, ['direction'], 'Troca de lugar com a vizinha no tema.'),
  HelpArticleResponse: object({ message: { type: 'string', example: 'Help article updated successfully!' }, article: ref('HelpArticle') }, ['message', 'article'])
} satisfies Record<HelpSchemaName, Schema>;
