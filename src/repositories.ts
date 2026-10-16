import { createInMemoryAccountRepository } from '#modules/accounts';
import { type ChatMessageRepository, type ChatRepository, createInMemoryChatMessageRepository, createInMemoryChatRepository } from '#modules/chat';
import type { AccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { type HelpArticleRepository, createInMemoryHelpArticleRepository } from '#modules/help';
import type { FarmerRepository } from '#modules/farmers';
import { createInMemoryFarmRepository } from '#modules/farms';
import type { FarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository, createInMemoryPaymentRepository } from '#modules/hiring';
import type { ApplicationRepository, PaymentRepository } from '#modules/hiring';
import { createInMemoryNotificationRepository, createInMemoryPushSubscriptionRepository } from '#modules/notifications';
import type { NotificationRepository, PushSubscriptionRepository } from '#modules/notifications';
import { type JobAlertRepository, type JobPreferencesRepository, createInMemoryJobAlertRepository, createInMemoryJobPreferencesRepository } from '#modules/matching';
import { type ReportRepository, createInMemoryReportRepository } from '#modules/reports';
import { type FarmReviewRepository, type WorkerReviewRepository, createInMemoryFarmReviewRepository, createInMemoryWorkerReviewRepository } from '#modules/reviews';
import { createInMemoryServiceRepository } from '#modules/services';
import type { ServiceRepository } from '#modules/services';
import { type SystemUserRepository, createInMemorySystemUserRepository } from '#modules/system-users';
import {
  type CertificateRepository,
  type EnrollmentRepository,
  type TrackRepository,
  createInMemoryCertificateRepository,
  createInMemoryEnrollmentRepository,
  createInMemoryTrackRepository
} from '#modules/tracks';
import { type VerificationRepository, createInMemoryVerificationRepository } from '#modules/verification';
import { type WorkerRepository, createInMemoryWorkerRepository } from '#modules/workers';

// Todos os repositórios da API (cada módulo declara a sua porta em src/modules/<módulo>/domain).
// A troca de persistência é passar outro `Repositories` em createContainer({ repos }).


export interface Repositories {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
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
    jobAlerts: createInMemoryJobAlertRepository()
  };
}
