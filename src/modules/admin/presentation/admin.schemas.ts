import { farmerSchema } from '#modules/farmers';
import { workerSchema } from '#modules/workers';
import { type Schema, id, object } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI da administração das contas (contrato em ../admin.contract.ts). Registrados em src/docs/schemas.ts.
export type AdminSchemaName = 'AdminUser';

export const adminSchemas = {
  AdminUser: object(
    {
      account_id: id,
      email: { type: 'string', format: 'email', example: 'ambos@exemplo.com' },
      farmer: { ...farmerSchema, nullable: true, description: 'Perfil de produtor (null = a conta não tem).' },
      worker: { ...workerSchema, nullable: true, description: 'Perfil de trabalhador (null = a conta não tem).' }
    },
    ['account_id', 'email', 'farmer', 'worker'],
    'Conta do app com os perfis. CPF mascarado na lista e completo no detalhe.'
  )
} satisfies Record<AdminSchemaName, Schema>;
