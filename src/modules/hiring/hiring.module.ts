import type { AccountRepository } from '#modules/accounts';
import type { JobEvents } from '#modules/services';
import type { AccessPolicies } from '#modules/auth';
import type { PushNotifier } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { AnalyzeApplicationUseCase } from './application/analyze-application.usecase';
import { AnswerProposalUseCase } from './application/answer-proposal.usecase';
import { hiringJobEvents } from './application/hiring-job-events';
import { ApplyForServiceUseCase } from './application/apply-for-service.usecase';
import { ListServiceApplicationsUseCase } from './application/list-service-applications.usecase';
import { PayServiceUseCase } from './application/pay-service.usecase';
import { ProposeUseCase } from './application/propose.usecase';
import { WatchServiceApplicationsUseCase } from './application/watch-service-applications.usecase';
import { WithdrawFromServiceUseCase } from './application/withdraw-from-service.usecase';
import type { ApplicationRepository } from './domain/application.repository';
import type { HiringEvents, NegotiationChats, WorkerReputationReader } from './domain/hiring-events';
import type { HiringTransaction } from './domain/hiring-transaction';
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
  // Aceite, recusa, desistência, propostas e pagamento gravam serviço, candidaturas, propostas e pagamento juntos.
  transaction: HiringTransaction;
  workers: WorkerRepository;
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
  // O cancelamento da vaga encerra as propostas pendentes (ligado no módulo de serviços pelo container).
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
    jobEvents: hiringJobEvents(deps)
  };
}

// Rotas HTTP da contratação (produtor em /api/farmers, trabalhador em /api/workers).
export function createHiringRoutes(useCases: HiringUseCases, access: AccessPolicies): HiringRoutes {
  return hiringRoutes(createHiringController(useCases), access);
}
