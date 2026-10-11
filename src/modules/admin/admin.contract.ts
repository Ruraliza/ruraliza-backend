import type { Farmer } from '#modules/farmers';
import type { Worker } from '#modules/workers';

// GET /admin/users e /admin/users/:id: uma conta do app com os perfis que ela tem.
// O CPF vem mascarado na lista e completo no detalhe.
export interface AdminUser {
  account_id: number;
  email: string;
  farmer: Farmer | null;
  worker: Worker | null;
}
