import type { Principal } from '#shared/infra/http/types';
import type { SystemRole } from '../system-user.contract';

// Id do usuário de sistema que fez a requisição. Só nas rotas com acesso de sistema: sem ele, é bug na rota.
export function systemUserId(principal: Principal | undefined): number {
  if (principal?.kind !== 'system') throw new Error('Rota de usuário de sistema sem usuário de sistema: confira o access da rota.');
  return principal.user.id;
}

// Id e cargo do usuário de sistema da requisição (o cargo é relido a cada requisição).
export function systemActor(principal: Principal | undefined): { id: number; role: SystemRole } {
  if (principal?.kind !== 'system') throw new Error('Rota de usuário de sistema sem usuário de sistema: confira o access da rota.');
  return { id: principal.user.id, role: principal.user.role };
}
