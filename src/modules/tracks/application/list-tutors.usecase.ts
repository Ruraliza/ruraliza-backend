import type { SystemUserRepository } from '#modules/system-users';
import type { TrackTutor } from '../track.contract';

// Quem pode ser tutor de uma trilha (para o editor escolher), em ordem alfabética.
export class ListTutorsUseCase {
  constructor(private readonly deps: { systemUsers: SystemUserRepository }) {}

  async execute(): Promise<TrackTutor[]> {
    return (await this.deps.systemUsers.find())
      .filter((user) => user.role === 'tutor')
      .map((user) => ({ id: user.id, name: user.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}
