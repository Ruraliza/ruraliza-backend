import { type SystemUserRecord, createInMemorySystemUserRepository } from '#modules/system-users';
import { type Worker, createInMemoryWorkerRepository } from '#modules/workers';
import { adjustableClock } from '#shared/testing/recorders';
import type { CertificateCodes } from '../domain/certificate';
import type { TrackRecord } from '../domain/track';
import { createInMemoryCertificateRepository, createInMemoryEnrollmentRepository, createInMemoryTrackRepository } from '../infra/in-memory-track.repositories';
import type { TracksModuleDeps } from '../tracks.module';

// Dependências das trilhas em memória, com relógio ajustável e códigos de certificado previsíveis
// (RZ-TEST-0001, RZ-TEST-0002...); e dados mínimos para montar cada cenário.

export const NOW = '2026-10-01T12:00:00.000Z';

export interface TracksTestbed extends TracksModuleDeps {
  setNow(iso: string): void;
}

export function sequentialCodes(): CertificateCodes {
  let n = 0;
  return { create: () => `RZ-TEST-${String((n += 1)).padStart(4, '0')}` };
}

export function tracksTestbed(): TracksTestbed {
  const clock = adjustableClock(NOW);
  return {
    tracks: createInMemoryTrackRepository(),
    enrollments: createInMemoryEnrollmentRepository(),
    certificates: createInMemoryCertificateRepository(),
    workers: createInMemoryWorkerRepository(),
    systemUsers: createInMemorySystemUserRepository(),
    clock,
    codes: sequentialCodes(),
    setNow: clock.set
  };
}

export function givenTutor(t: TracksTestbed, name = 'Tiago Tutor', role: SystemUserRecord['role'] = 'tutor'): Promise<SystemUserRecord> {
  return t.systemUsers.create({ email: `${name.split(' ')[0]?.toLowerCase() ?? 'x'}@exemplo.com`, name, role, password_hash: 'x', insertion_date: NOW });
}

export function givenWorker(t: TracksTestbed, name = 'Maria Trabalhadora'): Promise<Worker> {
  return t.workers.create({
    email: 'maria@exemplo.com', name, bio: null, certificates: null, courses: null, experience: null,
    phone: '1', cpf: '11144477735', photo_url: null, resume_url: null, insertion_date: NOW
  });
}

// Trilha com dois módulos (aulas 2 e 3 no primeiro, 5 no segundo), 10 + 20 + 30 minutos.
export function givenTrack(t: TracksTestbed, tutorId: number, changes: Partial<TrackRecord> = {}): Promise<TrackRecord> {
  return t.tracks.create({
    title: 'Colheita de café',
    description: 'Do ponto de colheita à secagem.',
    categories: ['Colheita'],
    tutor_ids: [tutorId],
    status: 'published',
    modules: [
      {
        id: 1, title: 'Preparação', lessons: [
          { id: 2, title: 'Quando colher', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', content: '', duration_minutes: 10 },
          { id: 3, title: 'Equipamentos', video_url: null, content: 'Luvas e peneira.', duration_minutes: 20 }
        ]
      },
      { id: 4, title: 'Na lavoura', lessons: [{ id: 5, title: 'Derriça', video_url: null, content: 'No pano.', duration_minutes: 30 }] }
    ],
    last_item_id: 5,
    created_by: tutorId,
    insertion_date: NOW,
    updated_at: NOW,
    published_at: NOW,
    ...changes
  });
}
