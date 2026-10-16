// Garante em tempo de compilação que o contrato da API (src/contracts) e os models do
// frontend (../ruraliza-frontend/src/app/core/models) são o MESMO tipo, nos dois sentidos.
// Rode com `npm run check:contracts` (precisa do frontend clonado ao lado deste repositório).
import type * as Api from '../src/contracts';
import type * as FrontAuth from '../../ruraliza-frontend/src/app/core/models/auth.model';
import type * as FrontConfig from '../../ruraliza-frontend/src/app/core/models/config.model';
import type * as FrontFarm from '../../ruraliza-frontend/src/app/core/models/farm.model';
import type * as FrontFarmStats from '../../ruraliza-frontend/src/app/core/models/farm-stats.model';
import type * as FrontFarmer from '../../ruraliza-frontend/src/app/core/models/farmer.model';
import type * as FrontHelp from '../../ruraliza-frontend/src/app/core/models/help.model';
import type * as FrontMatching from '../../ruraliza-frontend/src/app/core/models/matching.model';
import type * as FrontModeration from '../../ruraliza-frontend/src/app/core/models/moderation.model';
import type * as FrontNotification from '../../ruraliza-frontend/src/app/core/models/notification.model';
import type * as FrontPayment from '../../ruraliza-frontend/src/app/core/models/payment.model';
import type * as FrontPush from '../../ruraliza-frontend/src/app/core/models/push.model';
import type * as FrontReport from '../../ruraliza-frontend/src/app/core/models/report.model';
import type * as FrontReview from '../../ruraliza-frontend/src/app/core/models/review.model';
import type * as FrontChat from '../../ruraliza-frontend/src/app/core/models/chat.model';
import type * as FrontService from '../../ruraliza-frontend/src/app/core/models/service.model';
import type * as FrontApplication from '../../ruraliza-frontend/src/app/core/models/service-application.model';
import type * as FrontSponsor from '../../ruraliza-frontend/src/app/core/models/sponsor.model';
import type * as FrontStatus from '../../ruraliza-frontend/src/app/core/models/status';
import type * as FrontSystem from '../../ruraliza-frontend/src/app/core/models/system.model';
import type * as FrontTrack from '../../ruraliza-frontend/src/app/core/models/track.model';
import type * as FrontVerification from '../../ruraliza-frontend/src/app/core/models/verification.model';
import type * as FrontWorker from '../../ruraliza-frontend/src/app/core/models/worker.model';

// Igualdade estrita de tipos (distingue opcional de `| undefined`, readonly etc.).
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// Se algum item deixar de ser igual, o erro aponta a linha do tipo divergente.
export type ContractParity = [
  Expect<Equals<Api.ServiceStatus, FrontStatus.ServiceStatus>>,
  Expect<Equals<Api.ApplicationStatus, FrontStatus.ApplicationStatus>>,
  Expect<Equals<Api.PaymentStatus, FrontStatus.PaymentStatus>>,

  Expect<Equals<Api.MapsConfig, FrontConfig.MapsConfig>>,

  // Filtro de palavrões: a mesma lista nos dois lados (o formulário avisa, a API recusa).
  Expect<Equals<(typeof Api.BLOCKED_TERMS)[number], (typeof FrontModeration.BLOCKED_TERMS)[number]>>,

  Expect<Equals<Api.PushSubscriptionInput, FrontPush.PushSubscriptionInput>>,
  Expect<Equals<Api.PushUnsubscribeInput, FrontPush.PushUnsubscribeInput>>,
  Expect<Equals<Api.PushConfig, FrontPush.PushConfig>>,
  Expect<Equals<Api.WhatsAppConfig, FrontPush.WhatsAppConfig>>,

  Expect<Equals<Api.AppNotification, FrontNotification.AppNotification>>,
  Expect<Equals<Api.NotificationsPage, FrontNotification.NotificationsPage>>,
  Expect<Equals<Api.NotificationsReadInput, FrontNotification.NotificationsReadInput>>,
  Expect<Equals<Api.NotificationsReadResponse, FrontNotification.NotificationsReadResponse>>,

  Expect<Equals<Api.UserRole, FrontAuth.UserRole>>,
  Expect<Equals<Api.SessionUser, FrontAuth.SessionUser>>,
  Expect<Equals<Api.LoginInput, FrontAuth.LoginInput>>,
  Expect<Equals<Api.LoginResponse, FrontAuth.LoginResponse>>,
  Expect<Equals<Api.PasswordResetRequestInput, FrontAuth.PasswordResetRequestInput>>,
  Expect<Equals<Api.PasswordResetRequestResponse, FrontAuth.PasswordResetRequestResponse>>,
  Expect<Equals<Api.PasswordResetInput, FrontAuth.PasswordResetInput>>,
  Expect<Equals<Api.PasswordChangeInput, FrontAuth.PasswordChangeInput>>,
  Expect<Equals<Api.AccountProfiles, FrontAuth.AccountProfiles>>,
  Expect<Equals<Api.SessionResponse, FrontAuth.SessionResponse>>,
  Expect<Equals<Api.ProfileCreateInput, FrontAuth.ProfileCreateInput>>,
  Expect<Equals<Api.ActiveRoleInput, FrontAuth.ActiveRoleInput>>,
  Expect<Equals<Api.ThemePreference, FrontAuth.ThemePreference>>,
  Expect<Equals<Api.TextSize, FrontAuth.TextSize>>,
  Expect<Equals<Api.AccountPreferences, FrontAuth.AccountPreferences>>,
  Expect<Equals<Api.AccountPreferencesInput, FrontAuth.AccountPreferencesInput>>,
  Expect<Equals<Api.PreferencesResponse, FrontAuth.PreferencesResponse>>,

  Expect<Equals<Api.Farm, FrontFarm.Farm>>,
  Expect<Equals<Api.FarmInput, FrontFarm.FarmInput>>,
  Expect<Equals<Api.FarmUpdate, FrontFarm.FarmUpdate>>,
  Expect<Equals<Api.FarmLocation, FrontFarm.FarmLocation>>,
  Expect<Equals<Api.FarmPhoto, FrontFarm.FarmPhoto>>,

  Expect<Equals<Api.HelpTopic, FrontHelp.HelpTopic>>,
  Expect<Equals<Api.HelpArticle, FrontHelp.HelpArticle>>,
  Expect<Equals<Api.HelpArticleInput, FrontHelp.HelpArticleInput>>,
  Expect<Equals<Api.HelpArticleUpdate, FrontHelp.HelpArticleUpdate>>,
  Expect<Equals<Api.HelpArticleMoveInput, FrontHelp.HelpArticleMoveInput>>,
  Expect<Equals<Api.HelpArticleResponse, FrontHelp.HelpArticleResponse>>,

  Expect<Equals<Api.ReportTargetType, FrontReport.ReportTargetType>>,
  Expect<Equals<Api.ReportReason, FrontReport.ReportReason>>,
  Expect<Equals<Api.ReportStatus, FrontReport.ReportStatus>>,
  Expect<Equals<Api.ReportInput, FrontReport.ReportInput>>,
  Expect<Equals<Api.Report, FrontReport.Report>>,
  Expect<Equals<Api.ReportResponse, FrontReport.ReportResponse>>,
  Expect<Equals<Api.ReportParty, FrontReport.ReportParty>>,
  Expect<Equals<Api.AdminReport, FrontReport.AdminReport>>,
  Expect<Equals<Api.ReportReviewInput, FrontReport.ReportReviewInput>>,
  Expect<Equals<Api.AdminReportResponse, FrontReport.AdminReportResponse>>,

  Expect<Equals<Api.VerificationDocumentType, FrontVerification.VerificationDocumentType>>,
  Expect<Equals<Api.VerificationStatus, FrontVerification.VerificationStatus>>,
  Expect<Equals<Api.Verification, FrontVerification.Verification>>,
  Expect<Equals<Api.VerificationResponse, FrontVerification.VerificationResponse>>,
  Expect<Equals<Api.AdminVerification, FrontVerification.AdminVerification>>,
  Expect<Equals<Api.VerificationReviewInput, FrontVerification.VerificationReviewInput>>,
  Expect<Equals<Api.AdminVerificationResponse, FrontVerification.AdminVerificationResponse>>,

  Expect<Equals<Api.JobPreferencesNear, FrontMatching.JobPreferencesNear>>,
  Expect<Equals<Api.JobPreferences, FrontMatching.JobPreferences>>,
  Expect<Equals<Api.JobPreferencesResponse, FrontMatching.JobPreferencesResponse>>,
  Expect<Equals<Api.RecommendedJob, FrontMatching.RecommendedJob>>,

  Expect<Equals<Api.FarmerStatsRating, FrontFarmStats.FarmerStatsRating>>,
  Expect<Equals<Api.FarmerStatsMonth, FrontFarmStats.FarmerStatsMonth>>,
  Expect<Equals<Api.FarmerStatsCategory, FrontFarmStats.FarmerStatsCategory>>,
  Expect<Equals<Api.FarmerStatsPerson, FrontFarmStats.FarmerStatsPerson>>,
  Expect<Equals<Api.FarmerStats, FrontFarmStats.FarmerStats>>,

  Expect<Equals<Api.SponsorAudience, FrontSponsor.SponsorAudience>>,
  Expect<Equals<Api.SponsorCard, FrontSponsor.SponsorCard>>,
  Expect<Equals<Api.Sponsor, FrontSponsor.Sponsor>>,
  Expect<Equals<Api.SponsorInput, FrontSponsor.SponsorInput>>,
  Expect<Equals<Api.SponsorUpdate, FrontSponsor.SponsorUpdate>>,
  Expect<Equals<Api.SponsorResponse, FrontSponsor.SponsorResponse>>,
  Expect<Equals<Api.SponsorSlotResponse, FrontSponsor.SponsorSlotResponse>>,

  Expect<Equals<Api.Farmer, FrontFarmer.Farmer>>,
  Expect<Equals<Api.FarmerInput, FrontFarmer.FarmerInput>>,
  Expect<Equals<Api.FarmerUpdate, FrontFarmer.FarmerUpdate>>,

  Expect<Equals<Api.Worker, FrontWorker.Worker>>,
  Expect<Equals<Api.WorkerInput, FrontWorker.WorkerInput>>,
  Expect<Equals<Api.WorkerUpdate, FrontWorker.WorkerUpdate>>,

  Expect<Equals<Api.Service, FrontService.Service>>,
  Expect<Equals<Api.ServiceInput, FrontService.ServiceInput>>,
  Expect<Equals<Api.ServiceUpdate, FrontService.ServiceUpdate>>,
  Expect<Equals<Api.ServiceWithFarm, FrontService.ServiceWithFarm>>,
  Expect<Equals<Api.FarmerServiceItem, FrontService.FarmerServiceItem>>,
  Expect<Equals<Api.OpenService, FrontService.OpenService>>,
  Expect<Equals<Api.JobFilters, FrontService.JobFilters>>,
  Expect<Equals<Api.JobSort, FrontService.JobSort>>,

  Expect<Equals<Api.ServiceApplication, FrontApplication.ServiceApplication>>,
  Expect<Equals<Api.ApplicationWithWorker, FrontApplication.ApplicationWithWorker>>,
  Expect<Equals<Api.ApplicationWithService, FrontApplication.ApplicationWithService>>,
  Expect<Equals<Api.AnalyzeAction, FrontApplication.AnalyzeAction>>,

  Expect<Equals<Api.Payment, FrontPayment.Payment>>,

  Expect<Equals<Api.WorkerReviewScores, FrontReview.WorkerReviewScores>>,
  Expect<Equals<Api.FarmReviewScores, FrontReview.FarmReviewScores>>,
  Expect<Equals<Api.WorkerReview, FrontReview.WorkerReview>>,
  Expect<Equals<Api.FarmReview, FrontReview.FarmReview>>,
  Expect<Equals<Api.WorkerReviewInput, FrontReview.WorkerReviewInput>>,
  Expect<Equals<Api.FarmReviewInput, FrontReview.FarmReviewInput>>,
  Expect<Equals<Api.WorkerReputation, FrontReview.WorkerReputation>>,
  Expect<Equals<Api.FarmReputation, FrontReview.FarmReputation>>,
  Expect<Equals<Api.WorkerReviewItem, FrontReview.WorkerReviewItem>>,
  Expect<Equals<Api.FarmReviewItem, FrontReview.FarmReviewItem>>,
  Expect<Equals<Api.WorkerReviewsPage, FrontReview.WorkerReviewsPage>>,
  Expect<Equals<Api.FarmReviewsPage, FrontReview.FarmReviewsPage>>,
  Expect<Equals<Api.FarmerServiceReviews, FrontReview.FarmerServiceReviews>>,
  Expect<Equals<Api.WorkerServiceReviews, FrontReview.WorkerServiceReviews>>,
  Expect<Equals<Api.FarmerReviewResponse, FrontReview.FarmerReviewResponse>>,
  Expect<Equals<Api.WorkerReviewResponse, FrontReview.WorkerReviewResponse>>,
  Expect<Equals<Api.PendingReview, FrontReview.PendingReview>>,

  Expect<Equals<Api.ChatSender, FrontChat.ChatSender>>,
  Expect<Equals<Api.ChatMessage, FrontChat.ChatMessage>>,
  Expect<Equals<Api.ChatPerson, FrontChat.ChatPerson>>,
  Expect<Equals<Api.Chat, FrontChat.Chat>>,
  Expect<Equals<Api.ChatDetail, FrontChat.ChatDetail>>,
  Expect<Equals<Api.ChatMessageInput, FrontChat.ChatMessageInput>>,
  Expect<Equals<Api.ChatMessageResponse, FrontChat.ChatMessageResponse>>,
  Expect<Equals<Api.ChatPhoneInput, FrontChat.ChatPhoneInput>>,
  Expect<Equals<Api.ChatResponse, FrontChat.ChatResponse>>,

  Expect<Equals<Api.SystemRole, FrontSystem.SystemRole>>,
  Expect<Equals<Api.SystemUser, FrontSystem.SystemUser>>,
  Expect<Equals<Api.SystemLoginResponse, FrontSystem.SystemLoginResponse>>,
  Expect<Equals<Api.SystemUserInput, FrontSystem.SystemUserInput>>,
  Expect<Equals<Api.SystemUserResponse, FrontSystem.SystemUserResponse>>,
  Expect<Equals<Api.AdminUser, FrontSystem.AdminUser>>,
  Expect<Equals<Api.SystemUserUpdate, FrontSystem.SystemUserUpdate>>,
  Expect<Equals<Api.AdminSystemUserUpdate, FrontSystem.AdminSystemUserUpdate>>,

  Expect<Equals<Api.TrackStatus, FrontTrack.TrackStatus>>,
  Expect<Equals<Api.TrackTutor, FrontTrack.TrackTutor>>,
  Expect<Equals<Api.Lesson, FrontTrack.Lesson>>,
  Expect<Equals<Api.TrackModule, FrontTrack.TrackModule>>,
  Expect<Equals<Api.LessonOutline, FrontTrack.LessonOutline>>,
  Expect<Equals<Api.TrackModuleOutline, FrontTrack.TrackModuleOutline>>,
  Expect<Equals<Api.TrackProgress, FrontTrack.TrackProgress>>,
  Expect<Equals<Api.TrackSummary, FrontTrack.TrackSummary>>,
  Expect<Equals<Api.WorkerTrackSummary, FrontTrack.WorkerTrackSummary>>,
  Expect<Equals<Api.TrackDetail, FrontTrack.TrackDetail>>,
  Expect<Equals<Api.EnrolledTrack, FrontTrack.EnrolledTrack>>,
  Expect<Equals<Api.ManagedTrackSummary, FrontTrack.ManagedTrackSummary>>,
  Expect<Equals<Api.ManagedTrack, FrontTrack.ManagedTrack>>,
  Expect<Equals<Api.TrackInput, FrontTrack.TrackInput>>,
  Expect<Equals<Api.TrackUpdate, FrontTrack.TrackUpdate>>,
  Expect<Equals<Api.LessonInput, FrontTrack.LessonInput>>,
  Expect<Equals<Api.TrackModuleInput, FrontTrack.TrackModuleInput>>,
  Expect<Equals<Api.TrackContentInput, FrontTrack.TrackContentInput>>,
  Expect<Equals<Api.TrackStatusInput, FrontTrack.TrackStatusInput>>,
  Expect<Equals<Api.ManagedTrackResponse, FrontTrack.ManagedTrackResponse>>,
  Expect<Equals<Api.TrackFilters, FrontTrack.TrackFilters>>,
  Expect<Equals<Api.EnrollInput, FrontTrack.EnrollInput>>,
  Expect<Equals<Api.EnrolledTrackResponse, FrontTrack.EnrolledTrackResponse>>,
  Expect<Equals<Api.LessonCompletionResponse, FrontTrack.LessonCompletionResponse>>,
  Expect<Equals<Api.Certificate, FrontTrack.Certificate>>
];
