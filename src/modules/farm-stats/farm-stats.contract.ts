// Painel da fazenda (issue #22): os números do produtor, em todas as fazendas dele. "Horas trabalhadas" são
// as dos serviços concluídos (com o pagamento liberado), que é quando o trabalho fica validado no app.

// Média das avaliações publicadas que os trabalhadores deram às fazendas do produtor (pesada pela
// quantidade de avaliações de cada fazenda).
export interface FarmerStatsRating {
  average: number; // 1 a 5
  count: number;
  infrastructure: number | null;
  conditions: number | null;
  as_described: number | null;
}

export interface FarmerStatsMonth {
  month: string; // AAAA-MM (horário de Brasília)
  services: number;
  hours: number;
  paid: number; // R$
}

export interface FarmerStatsCategory {
  category: string;
  services: number;
  hours: number;
}

// Quem já passou por aqui: cada pessoa que concluiu serviço com o produtor.
export interface FarmerStatsPerson {
  worker_id: number;
  name: string; // '(perfil removido)' se não existe mais
  photo_url: string | null;
  services: number;
  hours: number;
  last_service_at: string; // ISO 8601: o último pagamento
}

// GET /farmers/:id/stats
export interface FarmerStats {
  services_completed: number;
  hours_completed: number;
  total_paid: number; // R$
  people_count: number; // pessoas diferentes que já concluíram serviço
  returning_people: number; // dessas, as que voltaram (2 serviços ou mais)
  rating: FarmerStatsRating | null; // null sem avaliação publicada
  open_jobs: number; // vagas abertas agora (recebendo candidaturas)
  pending_applications: number; // candidaturas esperando resposta
  months: FarmerStatsMonth[]; // os últimos 6 meses, do mais antigo para o atual (meses sem serviço vêm zerados)
  categories: FarmerStatsCategory[]; // mais horas primeiro
  people: FarmerStatsPerson[]; // o mais recente primeiro (até 20)
}
