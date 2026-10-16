// Contrato da API: formato de entidades, entradas e respostas.
// Espelha ruraliza-frontend/src/models; `npm run check:contracts` garante que os dois batem.
// Os módulos já migrados guardam o seu contrato em src/modules/<módulo>/<nome>.contract.ts;
// este arquivo continua sendo o ponto único que o check e o código legado importam.
export type * from '../shared/contracts/api';
export type { BLOCKED_TERMS } from '../shared/domain/moderation';

export type * from '../modules/accounts/accounts.contract';
export type * from '../modules/admin/admin.contract';
export type * from '../modules/auth/auth.contract';
export type * from '../modules/farmers/farmer.contract';
export type * from '../modules/farms/farm.contract';
export type * from '../modules/services/service.contract';
export type * from '../modules/system-users/system-user.contract';
export type * from '../modules/workers/worker.contract';
export type * from '../modules/hiring/hiring.contract';
export type * from '../modules/reviews/reviews.contract';
export type * from '../modules/chat/chat.contract';
export type * from '../modules/notifications/push.contract';
export type * from '../modules/notifications/notification.contract';
export type * from '../modules/platform/platform.contract';
export type * from '../modules/tracks/track.contract';
export type * from '../modules/help/help.contract';
export type * from '../modules/reports/report.contract';
export type * from '../modules/verification/verification.contract';
export type * from '../modules/matching/matching.contract';
