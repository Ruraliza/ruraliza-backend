import type { Principal } from '#shared/infra/http/types';

// Id do usuário de sistema que fez a requisição. Só nas rotas com acesso de sistema: sem ele, é bug na rota.
export function systemUserId(principal: Principal | undefined): number {
  if (principal?.kind !== 'system') throw new Error('Rota de usuário de sistema sem usuário de sistema: confira o access da rota.');
  return principal.user.id;
}
