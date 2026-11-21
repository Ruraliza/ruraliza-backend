import { type PushMessage, WORKER_PREFERENCES_URL } from '#modules/notifications';
import type { MatchingDeps } from './matching-deps';

export const CATALOG_NOTICE: PushMessage = {
  title: 'Seu perfil no catálogo de prestadores',
  body:
    'Seu perfil aparece para produtores que publicam vagas nas categorias que você escolheu. ' +
    'Você pode desligar quando quiser nas preferências de vaga.',
  url: WORKER_PREFERENCES_URL
};

// Aviso único do catálogo (ligado por padrão) para quem já tinha conta antes dele: na central de notificações e
// por push, levando às preferências. Roda na subida da API; cada aviso é reservado antes de sair, então uma nova
// subida (ou outra instância) não repete. Devolve quantos avisos saíram.
export async function sendCatalogNotices(deps: Pick<MatchingDeps, 'catalogNotices' | 'workers' | 'clock' | 'push'>): Promise<number> {
  let sent = 0;
  for (const workerId of await deps.catalogNotices.claimPending(deps.clock.now())) {
    if (!(await deps.workers.findById(workerId))) continue;
    deps.push.notify('worker', workerId, CATALOG_NOTICE);
    sent++;
  }
  return sent;
}
