// Garante em tempo de compilação que o contrato da API (src/contracts) e os models do
// frontend (../ruraliza-frontend/src/models) são o MESMO tipo, nos dois sentidos.
// Rode com `npm run check:contracts` (precisa do frontend clonado ao lado deste repositório).
import type * as Api from '../src/contracts';
import type * as FrontFarm from '../../ruraliza-frontend/src/models/farm.model';
import type * as FrontFarmer from '../../ruraliza-frontend/src/models/farmer.model';
import type * as FrontPayment from '../../ruraliza-frontend/src/models/payment.model';
import type * as FrontService from '../../ruraliza-frontend/src/models/service.model';
import type * as FrontApplication from '../../ruraliza-frontend/src/models/service-application.model';
import type * as FrontStatus from '../../ruraliza-frontend/src/models/status';
import type * as FrontWorker from '../../ruraliza-frontend/src/models/worker.model';

// Igualdade estrita de tipos (distingue opcional de `| undefined`, readonly etc.).
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// Se algum item deixar de ser igual, o erro aponta a linha do tipo divergente.
export type ContractParity = [
  Expect<Equals<Api.ServiceStatus, FrontStatus.ServiceStatus>>,
  Expect<Equals<Api.ApplicationStatus, FrontStatus.ApplicationStatus>>,
  Expect<Equals<Api.PaymentStatus, FrontStatus.PaymentStatus>>,

  Expect<Equals<Api.Farm, FrontFarm.Farm>>,
  Expect<Equals<Api.FarmInput, FrontFarm.FarmInput>>,
  Expect<Equals<Api.FarmUpdate, FrontFarm.FarmUpdate>>,
  Expect<Equals<Api.FarmLocation, FrontFarm.FarmLocation>>,

  Expect<Equals<Api.Farmer, FrontFarmer.Farmer>>,
  Expect<Equals<Api.FarmerInput, FrontFarmer.FarmerInput>>,
  Expect<Equals<Api.FarmerUpdate, FrontFarmer.FarmerUpdate>>,

  Expect<Equals<Api.Worker, FrontWorker.Worker>>,
  Expect<Equals<Api.WorkerInput, FrontWorker.WorkerInput>>,
  Expect<Equals<Api.WorkerUpdate, FrontWorker.WorkerUpdate>>,

  Expect<Equals<Api.Service, FrontService.Service>>,
  Expect<Equals<Api.ServiceInput, FrontService.ServiceInput>>,
  Expect<Equals<Api.ServiceUpdate, FrontService.ServiceUpdate>>,
  Expect<Equals<Api.ServiceWithFarm, FrontService.ServiceWithFarm>>,
  Expect<Equals<Api.FarmerServiceItem, FrontService.FarmerServiceItem>>,
  Expect<Equals<Api.OpenService, FrontService.OpenService>>,

  Expect<Equals<Api.ServiceApplication, FrontApplication.ServiceApplication>>,
  Expect<Equals<Api.ApplicationWithWorker, FrontApplication.ApplicationWithWorker>>,
  Expect<Equals<Api.ApplicationWithService, FrontApplication.ApplicationWithService>>,
  Expect<Equals<Api.AnalyzeAction, FrontApplication.AnalyzeAction>>,

  Expect<Equals<Api.Payment, FrontPayment.Payment>>
];
