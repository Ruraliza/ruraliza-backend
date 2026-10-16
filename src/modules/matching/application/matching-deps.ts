import { type AccountRepository, findAccountOf } from '#modules/accounts';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushNotifier } from '#modules/notifications';
import type { FarmReputationReader, FarmerVerificationReader, ServiceRepository } from '#modules/services';
import { TRACK_STATUS, type EnrollmentRepository, type TrackRepository } from '#modules/tracks';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import type { JobAlertRepository } from '../domain/job-alert';
import type { JobPreferencesRecord, JobPreferencesRepository } from '../domain/job-preferences';
import type { WorkerInterests } from '../domain/match';

export interface MatchingDeps {
  jobPreferences: JobPreferencesRepository;
  jobAlerts: JobAlertRepository;
  services: ServiceRepository;
  farms: FarmRepository;
  applications: ApplicationRepository;
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  workers: WorkerRepository;
  accounts: AccountRepository;
  reputation: FarmReputationReader;
  verification: FarmerVerificationReader;
  clock: Clock;
  push: PushNotifier;
}

export async function findPreferences(deps: MatchingDeps, workerId: number): Promise<JobPreferencesRecord | undefined> {
  const [record] = await deps.jobPreferences.find({ worker_id: workerId });
  return record;
}

// Tudo o que indica o que o trabalhador quer fazer: as categorias escolhidas, as das trilhas que ele faz
// (publicadas; a concluída vale mais) e as das vagas em que já se candidatou.
export async function interestsOf(deps: MatchingDeps, workerId: number, preferences?: JobPreferencesRecord): Promise<WorkerInterests> {
  const prefs = preferences ?? (await findPreferences(deps, workerId));
  const tracks = new Map<string, { title: string; completed: boolean }>();
  for (const enrollment of await deps.enrollments.find({ worker_id: workerId })) {
    const track = await deps.tracks.findById(enrollment.track_id);
    if (!track || track.status !== TRACK_STATUS.PUBLISHED) continue;
    const completed = enrollment.completed_at !== null;
    for (const category of track.categories) {
      const current = tracks.get(category);
      if (!current || (completed && !current.completed)) tracks.set(category, { title: track.title, completed });
    }
  }
  const history = new Set<string>();
  for (const application of await deps.applications.find({ worker_id: workerId })) {
    const service = await deps.services.findById(application.service_id);
    if (service) history.add(service.category);
  }
  return { chosen: new Set(prefs?.categories ?? []), tracks, history, near: prefs?.near ?? null };
}

// Vagas do próprio perfil de produtor (conta com os dois perfis) nunca são sugeridas.
export async function ownFarmerId(deps: MatchingDeps, workerId: number): Promise<number | null> {
  return (await findAccountOf(deps.accounts, 'worker', workerId))?.farmer_id ?? null;
}
