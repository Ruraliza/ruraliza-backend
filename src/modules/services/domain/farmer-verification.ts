// Produtores com a identidade conferida pela equipe (módulo de verificação; o container liga).
export interface FarmerVerificationReader {
  verifiedFarmers(farmerIds: readonly number[]): Promise<ReadonlySet<number>>;
}

export const NO_VERIFIED_FARMERS: FarmerVerificationReader = { verifiedFarmers: () => Promise.resolve(new Set()) };
