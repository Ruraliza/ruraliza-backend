import { type AccountSchemaName, accountSchemas } from '#modules/accounts';
import { type AdminSchemaName, adminSchemas } from '#modules/admin';
import { type AuthSchemaName, authSchemas } from '#modules/auth';
import { type ChatSchemaName, chatSchemas } from '#modules/chat';
import { type FarmerSchemaName, farmerSchemas } from '#modules/farmers';
import { type FarmSchemaName, farmSchemas } from '#modules/farms';
import { type HelpSchemaName, helpSchemas } from '#modules/help';
import { type HiringSchemaName, hiringSchemas } from '#modules/hiring';
import { type NotificationSchemaName, type PushSchemaName, notificationSchemas, pushSchemas } from '#modules/notifications';
import { type PlatformSchemaName, platformSchemas } from '#modules/platform';
import { type ReportSchemaName, reportSchemas } from '#modules/reports';
import { type ReviewSchemaName, reviewSchemas } from '#modules/reviews';
import { type ServiceSchemaName, serviceSchemas } from '#modules/services';
import { type SystemUserSchemaName, systemUserSchemas } from '#modules/system-users';
import { type TrackSchemaName, trackSchemas } from '#modules/tracks';
import { type WorkerSchemaName, workerSchemas } from '#modules/workers';
import { type CoreSchemaName, coreSchemas } from '#shared/infra/docs/core.schemas';
import type { Schema } from '#shared/infra/docs/schema-kit';

// Registro de todos os schemas OpenAPI: os genéricos (#shared/infra/docs) e os de cada módulo
// (src/modules/<módulo>/presentation/*.schemas.ts). Cada módulo só pode citar os nomes que declara
// (ou importa de outro módulo); o `satisfies` daqui confere que todo nome citado existe.
export type SchemaName =
  | CoreSchemaName
  | PlatformSchemaName
  | AccountSchemaName
  | AuthSchemaName
  | FarmerSchemaName
  | FarmSchemaName
  | WorkerSchemaName
  | ServiceSchemaName
  | HiringSchemaName
  | ReviewSchemaName
  | ChatSchemaName
  | PushSchemaName
  | NotificationSchemaName
  | SystemUserSchemaName
  | AdminSchemaName
  | TrackSchemaName
  | HelpSchemaName
  | ReportSchemaName;

export const schemas = {
  ...coreSchemas,
  ...platformSchemas,
  ...farmerSchemas,
  ...farmSchemas,
  ...workerSchemas,
  ...serviceSchemas,
  ...hiringSchemas,
  ...reviewSchemas,
  ...chatSchemas,
  ...pushSchemas,
  ...notificationSchemas,
  ...accountSchemas,
  ...authSchemas,
  ...systemUserSchemas,
  ...adminSchemas,
  ...trackSchemas,
  ...helpSchemas,
  ...reportSchemas
} satisfies Record<SchemaName, Schema>;
