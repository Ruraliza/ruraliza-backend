import { type Properties, type Schema, newPassword } from '#shared/infra/docs/schema-kit';

// Peças dos schemas de perfil (produtor e trabalhador), usadas também pelo segundo perfil da conta.

export const photoUrl: Schema = {
  type: 'string',
  nullable: true,
  example: '/api/images/3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.webp',
  description: 'Foto de perfil (WebP quadrado, no máximo 1000×1000px). null quando não há foto. Relativa à API.'
};

export const cpf: Schema = {
  type: 'string',
  example: '52998224725',
  description: '11 dígitos, só números. Completo no GET do próprio perfil; mascarado (***.982.247-**) em listas e respostas embutidas.'
};

// Campos editáveis dos dois perfis (o cpf só entra no cadastro).
export const profileEditableProps: Properties = {
  email: { type: 'string', format: 'email', example: 'ana@exemplo.com', description: 'Guardado em minúsculas. É o e-mail da conta: único entre as contas e o mesmo nos dois perfis dela.' },
  name: { type: 'string', example: 'Ana Produtora' },
  phone: { type: 'string', example: '24999990000', description: 'Com DDD, só números.' }
};

export const profileInputProps: Properties = {
  ...profileEditableProps,
  cpf: { ...cpf, description: '11 dígitos com dígitos verificadores válidos. Pertence a uma conta só.' },
  password: newPassword
};

export const optionalTextSchema: Schema = { type: 'string', nullable: true };
export const workerTextProps: Properties = {
  bio: { ...optionalTextSchema, maxLength: 500, description: 'Breve apresentação. Vazio vira null.' },
  certificates: { ...optionalTextSchema, maxLength: 1000, example: 'NR-31, curso de tratorista', description: 'Vazio vira null.' },
  courses: { ...optionalTextSchema, maxLength: 1000, example: 'Operação de trator (SENAR)', description: 'Vazio vira null.' },
  experience: { ...optionalTextSchema, maxLength: 1000, example: '5 anos em colheita de café', description: 'Vazio vira null.' }
};
