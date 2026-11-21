// Catálogo de prestadores e convites da demonstração: trabalhadores (sem conta de acesso) com interesses e regiões
// variadas, alguns com o catálogo desligado, e um convite em cada estado nas vagas abertas do produtor.
import { inviteAcceptedMessage } from '#modules/chat';
import type { Invite, InviteStatus } from '#modules/hiring';
import type { Service } from '#modules/services';
import type { Repositories } from './repositories';

const DAY_MS = 24 * 60 * 60 * 1000;

interface CatalogPerson {
  name: string;
  cpf: string;
  bio: string;
  experience: string;
  categories: string[];
  near: { latitude: number; longitude: number; radius_km: number } | null;
  catalog: boolean;
}

const PEOPLE: readonly CatalogPerson[] = [
  {
    name: 'Rita Colhedora', cpf: '52601815906', bio: 'Colheita de café e milho, com turma própria.', experience: '8 anos',
    categories: ['Colheita', 'Plantio'], near: { latitude: -22.12, longitude: -43.21, radius_km: 40 }, catalog: true
  },
  {
    name: 'Severino Cerqueiro', cpf: '08301661305', bio: 'Cerca de arame liso e farpado, porteira e mourão.', experience: '12 anos',
    categories: ['Conserto de cerca', 'Capina'], near: { latitude: -22.16, longitude: -43.29, radius_km: 30 }, catalog: true
  },
  {
    name: 'Lúcia Vaqueira', cpf: '18609139034', bio: 'Lida com gado de corte e de leite.', experience: '6 anos',
    categories: ['Manejo de gado', 'Ordenha'], near: { latitude: -22.12, longitude: -43.21, radius_km: 60 }, catalog: true
  },
  {
    name: 'Antônio Tratorista', cpf: '99603082430', bio: 'Trator, plantadeira e pulverizador de barra.', experience: '10 anos',
    categories: ['Operação de máquinas', 'Plantio', 'Pulverização'], near: { latitude: -22.51, longitude: -43.18, radius_km: 80 }, catalog: true
  },
  {
    name: 'Benedito da Serra', cpf: '62819482112', bio: 'Pulverização com bomba costal.', experience: '4 anos',
    categories: ['Pulverização'], near: { latitude: -21.76, longitude: -43.35, radius_km: 20 }, catalog: true // longe das fazendas: fora do raio
  },
  {
    name: 'Joana Reservada', cpf: '99351819019', bio: 'Prefere procurar as vagas sozinha.', experience: '3 anos',
    categories: ['Colheita'], near: null, catalog: false
  },
  {
    name: 'Geraldo Discreto', cpf: '93786579741', bio: 'Cerca e capina, só por indicação.', experience: '15 anos',
    categories: ['Conserto de cerca'], near: null, catalog: false
  }
];

export interface CatalogPeople {
  farmerId: number;
  mariaId: number;
}

export async function seedCatalog(repos: Repositories, now: string, people: CatalogPeople): Promise<void> {
  const shift = (days: number): string => new Date(Date.parse(now) + days * DAY_MS).toISOString();
  const ids = new Map<string, number>();
  for (const p of PEOPLE) {
    const worker = await repos.workers.create({
      email: `${p.name.split(' ')[0]?.toLowerCase() ?? 'catalogo'}.catalogo@exemplo.com`, name: p.name, bio: p.bio, certificates: null, courses: null,
      experience: p.experience, photo_url: null, resume_url: null, phone: '24900000000', cpf: p.cpf, insertion_date: shift(-20)
    });
    ids.set(p.name, worker.id);
    await repos.jobPreferences.create({
      worker_id: worker.id, categories: p.categories, near: p.near, alerts: false, catalog: p.catalog, last_digest_at: null
    });
  }

  const services = await repos.services.find({ farmer_id: people.farmerId, status: 'Pending' });
  const byName = (name: string): Service => {
    const service = services.find((s) => s.name === name);
    if (!service) throw new Error(`seed: vaga ${name} não existe`);
    return service;
  };
  const idOf = (name: string): number => ids.get(name) ?? 0;
  const invite = (service: Service, workerId: number, status: InviteStatus, daysAgo: number): Promise<Invite> =>
    repos.invites.create({
      service_id: service.id, farmer_id: people.farmerId, worker_id: workerId, status, insertion_date: shift(-daysAgo),
      answered_at: status === 'Accepted' || status === 'Declined' ? shift(-daysAgo + 0.2) : null
    });

  // Pendente: a Maria (trabalhador@exemplo.com) foi convidada para a apartação do rebanho.
  await invite(byName('Apartação do rebanho'), people.mariaId, 'Pending', 1);
  // Recusado: o Antônio recusou o plantio de milho (não pode ser convidado de novo).
  await invite(byName('Plantio de milho'), idOf('Antônio Tratorista'), 'Declined', 3);
  // Expirado: a vaga de limpeza do galpão venceu com o convite da Rita sem resposta.
  await invite(byName('Limpeza de galpão'), idOf('Rita Colhedora'), 'Expired', 4);

  // Aceito: o Severino virou candidato "Convidado" do conserto de cerca, com a conversa aberta.
  const cerca = byName('Conserto de cerca');
  const severino = idOf('Severino Cerqueiro');
  await invite(cerca, severino, 'Accepted', 0.5);
  await repos.applications.create({ service_id: cerca.id, worker_id: severino, status: 'Pending', invited: true, insertion_date: shift(-0.3) });
  const chat = await repos.chats.create({
    service_id: cerca.id, farmer_id: people.farmerId, worker_id: severino, farmer_shares_phone: false, worker_shares_phone: false,
    farmer_read_up_to: 0, worker_read_up_to: 0, closes_at: null, insertion_date: shift(-0.3)
  });
  const message = await repos.chatMessages.create({ chat_id: chat.id, sender: 'system', body: inviteAcceptedMessage('Severino Cerqueiro'), insertion_date: shift(-0.3) });
  await repos.chats.update({ ...chat, worker_read_up_to: message.id });
}
