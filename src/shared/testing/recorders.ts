import type { ChangeFeed, ChangeTopic } from '../domain/changes';
import type { Clock } from '../domain/clock';

// Dublês que gravam o que o código fez, para os testes conferirem quem foi avisado.

export interface RecordingChangeFeed extends ChangeFeed {
  published: ChangeTopic[][];
}

// Cada `publish` vira uma entrada de `published`; `subscribe` não faz nada.
export function recordingChangeFeed(): RecordingChangeFeed {
  const published: ChangeTopic[][] = [];
  return {
    published,
    publish: (topics) => { published.push([...topics]); },
    subscribe: () => () => undefined
  };
}

export interface SentPush {
  role: string;
  profileId: number;
  message: { title: string; body: string; url: string };
}

// Grava cada push (cumpre o PushNotifier sem depender do módulo de notificações).
export function recordingPush(): { sent: SentPush[]; notify: (role: string, profileId: number, message: SentPush['message']) => void } {
  const sent: SentPush[] = [];
  return { sent, notify: (role, profileId, message) => { sent.push({ role, profileId, message }); } };
}

// Relógio que o teste pode adiantar.
export function adjustableClock(start: string): Clock & { set: (iso: string) => void } {
  let now = start;
  return { now: () => now, set: (iso) => { now = iso; } };
}
