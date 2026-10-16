import { type UserRole, findAccountOf } from '#modules/accounts';
import { type Result, conflict, forbidden, invalid, notFound, ok } from '#shared/domain/result';
import { REPORTABLE, REPORTABLE_MESSAGE, toReport } from '../domain/report';
import type { Report, ReportInput } from '../report.contract';
import type { ReportDeps } from './report-deps';

export interface CreateReportCommand {
  role: UserRole;
  profileId: number;
  input: ReportInput;
}

// Denúncia nova, para a fila da equipe. Regras:
// - o trabalhador denuncia uma vaga ou um produtor; o produtor, um trabalhador;
// - ninguém denuncia a si mesmo (nem o próprio outro perfil da conta);
// - uma pessoa só pode ser denunciada por quem teve contato com ela: o trabalhador que se candidatou
//   a uma vaga do produtor, ou o produtor que recebeu a candidatura do trabalhador. Uma vaga
//   qualquer trabalhador denuncia (a vaga falsa aparece antes de qualquer contato);
// - a mesma pessoa não abre duas denúncias do mesmo alvo enquanto a primeira está em análise.
export class CreateReportUseCase {
  constructor(private readonly deps: ReportDeps) {}

  async execute({ role, profileId, input }: CreateReportCommand): Promise<Result<Report>> {
    const { reports, clock } = this.deps;
    if (!REPORTABLE[role].includes(input.target_type)) return invalid(REPORTABLE_MESSAGE[role]);
    const target = await this.checkTarget(role, profileId, input);
    if (!target.ok) return target;

    const { target_type, target_id } = input;
    const pending = await reports.find({ reporter_role: role, reporter_id: profileId, target_type, target_id, status: 'open' });
    if (pending.length > 0) return conflict('Você já denunciou isso, e a equipe está analisando.');

    const record = await reports.create({
      target_type, target_id, reason: input.reason, details: input.details ?? null, status: 'open', insertion_date: clock.now(),
      reporter_role: role, reporter_id: profileId, resolution_note: null, reviewed_at: null
    });
    return ok(toReport(record));
  }

  private async checkTarget(role: UserRole, profileId: number, { target_type, target_id }: ReportInput): Promise<Result<true>> {
    const { services, farmers, workers, accounts } = this.deps;
    const own = await findAccountOf(accounts, role, profileId);

    if (target_type === 'service') {
      const service = await services.findById(target_id);
      if (!service) return notFound('Vaga não encontrada.');
      return own?.farmer_id === service.farmer_id ? invalid('Esta vaga é sua.') : ok(true);
    }
    if (target_type === 'farmer') {
      if (!(await farmers.findById(target_id))) return notFound('Produtor não encontrado.');
      if (own?.farmer_id === target_id) return invalid('Você não pode denunciar o seu próprio perfil.');
      return (await this.applied(profileId, target_id))
        ? ok(true)
        : forbidden('Só dá para denunciar um produtor depois de se candidatar a uma vaga dele. Se a vaga parece falsa, denuncie a vaga.');
    }
    if (!(await workers.findById(target_id))) return notFound('Trabalhador não encontrado.');
    if (own?.worker_id === target_id) return invalid('Você não pode denunciar o seu próprio perfil.');
    return (await this.applied(target_id, profileId)) ? ok(true) : forbidden('Só dá para denunciar quem se candidatou a um serviço seu.');
  }

  // O trabalhador já se candidatou a algum serviço do produtor?
  private async applied(workerId: number, farmerId: number): Promise<boolean> {
    const { applications, services } = this.deps;
    for (const application of await applications.find({ worker_id: workerId })) {
      if ((await services.findById(application.service_id))?.farmer_id === farmerId) return true;
    }
    return false;
  }
}
