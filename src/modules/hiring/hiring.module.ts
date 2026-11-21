import type { AccountRepository } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import type { JobEvents } from '#modules/services';
import type { AccessPolicies } from '#modules/auth';
import type { PushNotifier } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import { AnalyzeApplicationUseCase } from './application/analyze-application.usecase';
import { AnswerInviteUseCase } from './application/answer-invite.usecase';
import { AnswerProposalUseCase } from './application/answer-proposal.usecase';
import { hiringJobEvents } from './application/hiring-job-events';
import { ApplyForServiceUseCase } from './application/apply-for-service.usecase';
import { invitesCleanup } from './application/invite-cleanup';
import { InviteWorkerUseCase } from './application/invite-worker.usecase';
import { ListServiceApplicationsUseCase } from './application/list-service-applications.usecase';
import { ListWorkerInvitesUseCase } from './application/list-worker-invites.usecase';
import { PayServiceUseCase } from './application/pay-service.usecase';
import { ProposeUseCase } from './application/propose.usecase';
import { WatchServiceApplicationsUseCase } from './application/watch-service-applications.usecase';
import { WithdrawFromServiceUseCase } from './application/withdraw-from-service.usecase';
import type { ApplicationRepository } from './domain/application.repository';
import type { CatalogCheck, HiringEvents, NegotiationChats, WorkerReputationReader } from './domain/hiring-events';
import type { HiringTransaction } from './domain/hiring-transaction';
import type { InviteRepository } from './domain/invite.repository';
import type { PaymentRepository } from './domain/payment.repository';
import type { ProposalRepository } from './domain/proposal.repository';
import type { WorkerVerificationReader } from './domain/worker-verification';
import { createHiringController } from './presentation/hiring.controller';
import { type HiringRoutes, hiringRoutes } from './presentation/hiring.routes';

export interface HiringModuleDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
  proposals: ProposalRepository;
  invites: InviteRepository;
  // Aceite, recusa, desistência, propostas e pagamento gravam serviço, candidaturas, propostas e pagamento juntos.
  transaction: HiringTransaction;
  workers: WorkerRepository;
  farmers: FarmerRepository;
  farms: FarmRepository;
  accounts: AccountRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
  // Quem acompanha as etapas (a conversa) e quem dá a reputação dos candidatos (avaliações).
  events: HiringEvents;
  // A conversa onde as propostas são feitas (módulo de conversas).
  chats: NegotiationChats;
  reputation: WorkerReputationReader;
  verification: WorkerVerificationReader;
  // Se o trabalhador está no catálogo da vaga (módulo de vagas para você), conferido de novo a cada convite.
  catalog: CatalogCheck;
}

export interface HiringUseCases {
  applyForService: ApplyForServiceUseCase;
  analyzeApplication: AnalyzeApplicationUseCase;
  withdrawFromService: WithdrawFromServiceUseCase;
  payService: PayServiceUseCase;
  propose: ProposeUseCase;
  answerProposal: AnswerProposalUseCase;
  listServiceApplications: ListServiceApplicationsUseCase;
  watchServiceApplications: WatchServiceApplicationsUseCase;
  inviteWorker: InviteWorkerUseCase;
  listWorkerInvites: ListWorkerInvitesUseCase;
  answerInvite: AnswerInviteUseCase;
  // Apaga os convites de um perfil removido.
  cleanup: ProfileCleanup;
  // O cancelamento da vaga encerra as propostas pendentes e expira os convites (ligado no módulo de serviços pelo container).
  jobEvents: Pick<JobEvents, 'jobCancelled'>;
}

// Casos de uso da contratação (montados pelo container). Cada um altera várias entidades juntas
// e, no fim, avisa as telas abertas (`changes`) e manda push para quem precisa agir ou saber (`push`).
export function createHiringUseCases(deps: HiringModuleDeps): HiringUseCases {
  return {
    applyForService: new ApplyForServiceUseCase(deps),
    analyzeApplication: new AnalyzeApplicationUseCase(deps),
    withdrawFromService: new WithdrawFromServiceUseCase(deps),
    payService: new PayServiceUseCase(deps),
    propose: new ProposeUseCase(deps),
    answerProposal: new AnswerProposalUseCase(deps),
    listServiceApplications: new ListServiceApplicationsUseCase(deps),
    watchServiceApplications: new WatchServiceApplicationsUseCase(deps),
    inviteWorker: new InviteWorkerUseCase(deps),
    listWorkerInvites: new ListWorkerInvitesUseCase(deps),
    answerInvite: new AnswerInviteUseCase(deps),
    cleanup: invitesCleanup(deps),
    jobEvents: hiringJobEvents(deps)
  };
}

// Rotas HTTP da contratação (produtor em /api/farmers, trabalhador em /api/workers).
export function createHiringRoutes(useCases: HiringUseCases, access: AccessPolicies): HiringRoutes {
  return hiringRoutes(createHiringController(useCases), access);
}
