import type { AccessPolicies } from '#modules/auth';
import { CountSponsorClickUseCase } from './application/count-sponsor-click.usecase';
import { CreateSponsorUseCase } from './application/create-sponsor.usecase';
import { DeleteSponsorUseCase } from './application/delete-sponsor.usecase';
import { ListSponsorsUseCase } from './application/list-sponsors.usecase';
import { RemoveSponsorImageUseCase } from './application/remove-sponsor-image.usecase';
import { ServeSponsorSlotUseCase } from './application/serve-sponsor-slot.usecase';
import { SetSponsorImageUseCase } from './application/set-sponsor-image.usecase';
import type { SponsorDeps } from './application/sponsor-deps';
import { UpdateSponsorUseCase } from './application/update-sponsor.usecase';
import { createSponsorController } from './presentation/sponsor.controller';
import { type SponsorRoutes, sponsorRoutes } from './presentation/sponsor.routes';

export type SponsorsModuleDeps = SponsorDeps;

export interface SponsorUseCases {
  serve: ServeSponsorSlotUseCase;
  click: CountSponsorClickUseCase;
  list: ListSponsorsUseCase;
  create: CreateSponsorUseCase;
  update: UpdateSponsorUseCase;
  remove: DeleteSponsorUseCase;
  setImage: SetSponsorImageUseCase;
  removeImage: RemoveSponsorImageUseCase;
}

// Casos de uso dos patrocínios (montados pelo container).
export function createSponsorUseCases(deps: SponsorsModuleDeps): SponsorUseCases {
  return {
    serve: new ServeSponsorSlotUseCase(deps),
    click: new CountSponsorClickUseCase(deps),
    list: new ListSponsorsUseCase(deps),
    create: new CreateSponsorUseCase(deps),
    update: new UpdateSponsorUseCase(deps),
    remove: new DeleteSponsorUseCase(deps),
    setImage: new SetSponsorImageUseCase(deps),
    removeImage: new RemoveSponsorImageUseCase(deps)
  };
}

// Rotas HTTP (o cartão em /api/sponsors; a gestão em /api/admin/sponsors).
export function createSponsorRoutes(useCases: SponsorUseCases, access: AccessPolicies): SponsorRoutes {
  return sponsorRoutes(createSponsorController(useCases), access);
}
