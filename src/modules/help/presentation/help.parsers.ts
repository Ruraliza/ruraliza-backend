import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { missingFields, text } from '#shared/utils/validation';
import { ANSWER_MAX_LENGTH, HELP_TOPICS, QUESTION_MAX_LENGTH } from '../domain/help-article';
import type { HelpArticleInput, HelpArticleMoveInput, HelpArticleUpdate, HelpTopic } from '../help.contract';

// Formato dos corpos da gestão da central de ajuda (400).

function parseTopic(value: unknown): Result<HelpTopic> {
  const topic = HELP_TOPICS.find((t) => t === value);
  return topic ? ok(topic) : invalid(`O tema (topic) deve ser um destes: ${HELP_TOPICS.join(', ')}.`);
}

function parseQuestion(value: unknown): Result<string> {
  const question = text(value).trim();
  if (!question) return invalid('Escreva a pergunta.');
  if (question.length > QUESTION_MAX_LENGTH) return invalid(`A pergunta pode ter até ${QUESTION_MAX_LENGTH} caracteres.`);
  return ok(question);
}

function parseAnswer(value: unknown): Result<string> {
  const answer = text(value).trim();
  if (!answer) return invalid('Escreva a resposta.');
  if (answer.length > ANSWER_MAX_LENGTH) return invalid(`A resposta pode ter até ${ANSWER_MAX_LENGTH} caracteres.`);
  return ok(answer);
}

export function parseHelpArticleInput(body: Body): Result<HelpArticleInput> {
  const missing = missingFields(body, ['question', 'answer', 'topic']);
  if (missing.length > 0) return invalid(missingMessage(missing));
  const question = parseQuestion(body['question']);
  if (!question.ok) return question;
  const answer = parseAnswer(body['answer']);
  if (!answer.ok) return answer;
  const topic = parseTopic(body['topic']);
  if (!topic.ok) return topic;
  const published = body['published'];
  if (published !== undefined && typeof published !== 'boolean') return invalid('Publicada (published) deve ser true ou false.');
  return ok({ question: question.value, answer: answer.value, topic: topic.value, ...(published === undefined ? {} : { published }) });
}

export function parseHelpArticleUpdate(body: Body): Result<HelpArticleUpdate> {
  const changes: HelpArticleUpdate = {};
  if (body['question'] !== undefined) {
    const question = parseQuestion(body['question']);
    if (!question.ok) return question;
    changes.question = question.value;
  }
  if (body['answer'] !== undefined) {
    const answer = parseAnswer(body['answer']);
    if (!answer.ok) return answer;
    changes.answer = answer.value;
  }
  if (body['topic'] !== undefined) {
    const topic = parseTopic(body['topic']);
    if (!topic.ok) return topic;
    changes.topic = topic.value;
  }
  if (body['published'] !== undefined) {
    if (typeof body['published'] !== 'boolean') return invalid('Publicada (published) deve ser true ou false.');
    changes.published = body['published'];
  }
  return Object.keys(changes).length > 0 ? ok(changes) : invalid('Envie ao menos um campo: question, answer, topic ou published.');
}

export function parseHelpArticleMove(body: Body): Result<HelpArticleMoveInput> {
  const direction = body['direction'];
  return direction === 'up' || direction === 'down' ? ok({ direction }) : invalid("A direção (direction) deve ser 'up' ou 'down'.");
}
