export interface Farm {
  id: number;
  farmer_id: number;
  address: string;
  city: string;
  state: string;
  insertion_date: string;
  deleted_at?: string; // fazenda removida pelo produtor, mantida só no histórico dos serviços
}

// POST /farmers/:id/farms
export interface FarmInput {
  address: string;
  city: string;
  state: string;
}

// PATCH /farmers/:id/farms/:farmId
export type FarmUpdate = Partial<FarmInput>;

// Local da fazenda exposto ao trabalhador (sem o endereço completo).
export interface FarmLocation {
  city: string;
  state: string;
}
