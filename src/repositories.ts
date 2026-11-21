import { createInMemoryAccountRepository, createPgAccountRepository } from '#modules/accounts';
import {
  type ChatMessageRepository,
  type ChatRepository,
  createInMemoryChatMessageRepository,
  createInMemoryChatRepository,
  createPgChatMessageRepository,
  createPgChatRepository
} from '#modules/chat';
import type { AccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository, createPgFarmerRepository } from '#modules/farmers';
import { type HelpArticleRepository, createInMemoryHelpArticleRepository, createPgHelpArticleRepository } from '#modules/help';
import type { FarmerRepository } from '#modules/farmers';
import { createInMemoryFarmRepository, createPgFarmRepository } from '#modules/farms';
import type { FarmRepository } from '#modules/farms';
import {
  createInMemoryApplicationRepository,
  createInMemoryPaymentRepository,
  createInMemoryProposalRepository,
  createPgApplicationRepository,
  createPgPaymentRepository,
  createPgProposalRepository
} from '#modules/hiring';
import type { ApplicationRepository, PaymentRepository, ProposalRepository } from '#modules/hiring';
import {
  createInMemoryNotificationRepository,
  createInMemoryPushSubscriptionRepository,
  createPgNotificationRepository,
  createPgPushSubscriptionRepository
} from '#modules/notifications';
import type { NotificationRepository, PushSubscriptionRepository } from '#modules/notifications';
import {
  type JobAlertRepository,
  type JobPreferencesRepository,
  createInMemoryJobAlertRepository,
  createInMemoryJobPreferencesRepository,
  createPgJobAlertRepository,
  createPgJobPreferencesRepository
} from '#modules/matching';
import { type ReportRepository, createInMemoryReportRepository, createPgReportRepository } from '#modules/reports';
import { type SponsorRepository, createInMemorySponsorRepository, createPgSponsorRepository } from '#modules/sponsors';
import {
  type FarmReviewRepository,
  type WorkerReviewRepository,
  createInMemoryFarmReviewRepository,
  createInMemoryWorkerReviewRepository,
  createPgFarmReviewRepository,
  createPgWorkerReviewRepository
} from '#modules/reviews';
import { createInMemoryServiceRepository, createPgServiceRepository } from '#modules/services';
import type { ServiceRepository } from '#modules/services';
import { type SystemUserRepository, createInMemorySystemUserRepository, createPgSystemUserRepository } from '#modules/system-users';
import {
  type CertificateRepository,
  type EnrollmentRepository,
  type TrackRepository,
  createInMemoryCertificateRepository,
  createInMemoryEnrollmentRepository,
  createInMemoryTrackRepository,
  createPgCertificateRepository,
  createPgEnrollmentRepository,
  createPgTrackRepository
} from '#modules/tracks';
import { type VerificationRepository, createInMemoryVerificationRepository, createPgVerificationRepository } from '#modules/verification';
import { type WorkerRepository, createInMemoryWorkerRepository, createPgWorkerRepository } from '#modules/workers';
import type { Database } from '#shared/infra/postgres/database';

// Todos os repositórios da API (cada módulo declara a sua porta em src/modules/<módulo>/domain).
// A persistência é escolhida passando um `Repositories` em createContainer({ repos }): em memória ou PostgreSQL.


export interface Repositories {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
  proposals: ProposalRepository;
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  notifications: NotificationRepository;
  systemUsers: SystemUserRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
  helpArticles: HelpArticleRepository;
  reports: ReportRepository;
  verifications: VerificationRepository;
  jobPreferences: JobPreferencesRepository;
  jobAlerts: JobAlertRepository;
  sponsors: SponsorRepository;
}

// Repositórios em memória (um conjunto novo por chamada, isolado dos outros).
export function createInMemoryRepositories(): Repositories {
  return {
    farmers: createInMemoryFarmerRepository(),
    workers: createInMemoryWorkerRepository(),
    farms: createInMemoryFarmRepository(),
    services: createInMemoryServiceRepository(),
    applications: createInMemoryApplicationRepository(),
    payments: createInMemoryPaymentRepository(),
    proposals: createInMemoryProposalRepository(),
    accounts: createInMemoryAccountRepository(),
    pushSubscriptions: createInMemoryPushSubscriptionRepository(),
    notifications: createInMemoryNotificationRepository(),
    systemUsers: createInMemorySystemUserRepository(),
    workerReviews: createInMemoryWorkerReviewRepository(),
    farmReviews: createInMemoryFarmReviewRepository(),
    chats: createInMemoryChatRepository(),
    chatMessages: createInMemoryChatMessageRepository(),
    tracks: createInMemoryTrackRepository(),
    enrollments: createInMemoryEnrollmentRepository(),
    certificates: createInMemoryCertificateRepository(),
    helpArticles: createInMemoryHelpArticleRepository(),
    reports: createInMemoryReportRepository(),
    verifications: createInMemoryVerificationRepository(),
    jobPreferences: createInMemoryJobPreferencesRepository(),
    jobAlerts: createInMemoryJobAlertRepository(),
    sponsors: createInMemorySponsorRepository()
  };
}

// Repositórios em PostgreSQL sobre o mesmo banco: o pool, ou uma conexão em transação (inTransaction).
export function createPostgresRepositories(db: Database): Repositories {
  return {
    farmers: createPgFarmerRepository(db),
    workers: createPgWorkerRepository(db),
    farms: createPgFarmRepository(db),
    services: createPgServiceRepository(db),
    applications: createPgApplicationRepository(db),
    payments: createPgPaymentRepository(db),
    proposals: createPgProposalRepository(db),
    accounts: createPgAccountRepository(db),
    pushSubscriptions: createPgPushSubscriptionRepository(db),
    notifications: createPgNotificationRepository(db),
    systemUsers: createPgSystemUserRepository(db),
    workerReviews: createPgWorkerReviewRepository(db),
    farmReviews: createPgFarmReviewRepository(db),
    chats: createPgChatRepository(db),
    chatMessages: createPgChatMessageRepository(db),
    tracks: createPgTrackRepository(db),
    enrollments: createPgEnrollmentRepository(db),
    certificates: createPgCertificateRepository(db),
    helpArticles: createPgHelpArticleRepository(db),
    reports: createPgReportRepository(db),
    verifications: createPgVerificationRepository(db),
    jobPreferences: createPgJobPreferencesRepository(db),
    jobAlerts: createPgJobAlertRepository(db),
    sponsors: createPgSponsorRepository(db)
  };
}
