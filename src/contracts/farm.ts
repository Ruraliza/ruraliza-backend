// Foto guardada no ImageStore (WebP ≤ 1000px). `id` é usado para remover.
export interface FarmPhoto {
  id: string;
  url: string;
}

export interface Farm {
  id: number;
  farmer_id: number;
  address: string;
  city: string;
  state: string;
  photos: FarmPhoto[]; // até 6, na ordem de envio (a primeira é a capa)
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
  photos: string[]; // URLs das fotos da fazenda (a primeira é a capa)
}
