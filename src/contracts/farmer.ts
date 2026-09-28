export interface Farmer {
  id: number;
  email: string;
  name: string;
  farms: number[]; // IDs das fazendas ativas
  phone: string;
  cpf: string; // completo só no GET do próprio perfil; mascarado em listas
  insertion_date: string;
}

// POST /farmers
export interface FarmerInput {
  email: string;
  name: string;
  phone: string;
  cpf: string;
}

// PATCH /farmers/:id (id e cpf não podem ser alterados)
export type FarmerUpdate = Partial<Omit<FarmerInput, 'cpf'>>;
