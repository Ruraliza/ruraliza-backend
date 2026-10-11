// Dados de outros módulos que saem junto com um perfil removido (conversas e avaliações).
// Os casos de uso de remoção só chamam; o container liga as implementações (src/container.ts).
export interface ProfileCleanup {
  farmerRemoved(farmerId: number): Promise<void>;
  workerRemoved(workerId: number): Promise<void>;
}

// Para testes que não envolvem conversas nem avaliações.
export const NO_PROFILE_CLEANUP: ProfileCleanup = {
  farmerRemoved: () => Promise.resolve(),
  workerRemoved: () => Promise.resolve()
};
