// Tipos de serviço, em dois níveis: grupo > serviço. É a única fonte da verdade.
// O serviço (não o grupo) é o que se grava em services.category, job_preferences.categories,
// sponsors.categories e tracks.categories. Os 7 valores originais (Colheita, Plantio, Manutenção,
// Pulverização, Operação de máquinas, Manejo de gado e Outros) já estão gravados: não renomeie nem remova.
// Só entram trabalhos que não exigem curso nem certificação obrigatória.
export interface ServiceGroup {
  readonly name: string;
  readonly services: readonly string[];
}

export const CATEGORY_GROUPS: readonly ServiceGroup[] = Object.freeze([
  {
    name: 'Lavoura e horta',
    services: ['Colheita', 'Plantio', 'Pulverização', 'Capina', 'Preparo de canteiro', 'Ensacamento e seleção de grãos']
  },
  {
    name: 'Cercas e construções',
    services: [
      'Conserto de cerca', 'Construção de cerca', 'Troca de mourões e esticadores', 'Porteiras e colchetes',
      'Curral, brete e tronco', 'Reforma de galpão, paiol e cocho', 'Pequenas obras de alvenaria', 'Manutenção'
    ]
  },
  {
    name: 'Água',
    services: [
      'Encanamento e caixa d\'água', 'Limpeza de represa, açude e cisterna', 'Instalação e manutenção de irrigação',
      'Conserto de roda d\'água e carneiro hidráulico'
    ]
  },
  {
    name: 'Pasto e terreno',
    services: ['Roçada manual', 'Limpeza de pasto', 'Aceiro manual', 'Conservação de estrada interna', 'Poda manual']
  },
  {
    name: 'Animais',
    services: ['Manejo de gado', 'Vaqueiro e peão', 'Ordenha', 'Trato de animais', 'Casqueamento e ferrageamento', 'Doma e lida com cavalos']
  },
  { name: 'Máquinas', services: ['Operação de máquinas'] },
  { name: 'Outros', services: ['Outros'] }
]);

// Lista plana dos serviços, na ordem dos grupos (GET /api/categories e as validações).
export const CATEGORIES: readonly string[] = Object.freeze(CATEGORY_GROUPS.flatMap((g) => g.services));

export const CATEGORY_GROUP_NAMES: readonly string[] = Object.freeze(CATEGORY_GROUPS.map((g) => g.name));

export function isCategory(value: unknown): value is string {
  return typeof value === 'string' && CATEGORIES.includes(value);
}

// Serviços de um grupo (undefined se o grupo não existe).
export function servicesOfGroup(name: string): readonly string[] | undefined {
  return CATEGORY_GROUPS.find((g) => g.name === name)?.services;
}
