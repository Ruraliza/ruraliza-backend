// Texto para busca: sem acento e em minúsculas ("Colheita de Café" vira "colheita de cafe").
export function searchable(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
