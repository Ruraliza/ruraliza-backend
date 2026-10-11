import { type Properties, type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { MAX_CHAT_MESSAGE } from '../domain/chat.rules';

// Schemas OpenAPI das conversas (contrato em ../chat.contract.ts). Registrados em src/docs/schemas.ts.
export type ChatSchemaName =
  | 'ChatSender' | 'ChatMessage' | 'ChatPerson' | 'Chat' | 'ChatDetail'
  | 'ChatMessageInput' | 'ChatMessageResponse' | 'ChatPhoneInput' | 'ChatResponse';

const ref: RefTo<ChatSchemaName> = refTo;

// Também aparece como `nullable` em Chat.last_message (allOf + nullable não aceita null).
const chatMessageSchema: Schema = object(
  { id, chat_id: id, sender: ref('ChatSender'), body: { type: 'string', example: 'Chego às 7h na porteira.' }, insertion_date: isoDate },
  ['id', 'chat_id', 'sender', 'body', 'insertion_date']
);

const chatProps: Properties = {
  id,
  service_id: id,
  service_name: { type: 'string', example: 'Colheita de café' },
  farmer_id: id,
  worker_id: id,
  farmer: ref('ChatPerson'),
  worker: ref('ChatPerson'),
  farmer_shares_phone: { type: 'boolean', description: 'O produtor liberou o WhatsApp.' },
  worker_shares_phone: { type: 'boolean', description: 'O trabalhador liberou o WhatsApp.' },
  open: { type: 'boolean', description: 'A conversa aceita mensagens.' },
  closes_at: { ...isoDate, nullable: true, description: 'Quando deixa (ou deixou) de aceitar mensagens; null com o serviço em andamento.' },
  unread: { type: 'integer', minimum: 0, example: 2, description: 'Mensagens da outra parte e avisos ainda não lidos por quem pediu.' },
  last_message: { ...chatMessageSchema, nullable: true },
  insertion_date: isoDate
};
const chatRequired = Object.keys(chatProps);

export const chatSchemas = {
  ChatSender: { type: 'string', enum: ['farmer', 'worker', 'system'], description: "'system': aviso da plataforma." },
  ChatMessage: chatMessageSchema,
  ChatPerson: object(
    {
      name: { type: 'string', example: 'Maria Trabalhadora' },
      photo_url: { type: 'string', nullable: true, example: null },
      phone: { type: 'string', nullable: true, example: null, description: 'Só quando os dois liberaram o WhatsApp.' }
    },
    ['name', 'photo_url', 'phone']
  ),
  Chat: object(chatProps, chatRequired),
  ChatDetail: object(
    { ...chatProps, messages: { type: 'array', items: ref('ChatMessage'), description: 'Da mais antiga para a mais nova.' } },
    [...chatRequired, 'messages']
  ),
  ChatMessageInput: input({ body: { type: 'string', minLength: 1, maxLength: MAX_CHAT_MESSAGE, example: 'Que horas começo?' } }, ['body'], 'Texto da mensagem.'),
  ChatMessageResponse: object(
    {
      message: { type: 'string', example: 'Message sent.' },
      sent: ref('ChatMessage'),
      masked: { type: 'boolean', description: 'Telefone ou e-mail no texto foi ocultado.' }
    },
    ['message', 'sent', 'masked']
  ),
  ChatPhoneInput: input({ share: { type: 'boolean', example: true } }, ['share'], 'true libera o seu WhatsApp; false deixa de compartilhar.'),
  ChatResponse: object({ message: { type: 'string', example: 'Phone shared.' }, chat: ref('Chat') }, ['message', 'chat'])
} satisfies Record<ChatSchemaName, Schema>;
