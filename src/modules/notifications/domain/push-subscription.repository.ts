import type { Repository } from '#shared/domain/repository';
import type { PushSubscriptionRecord } from './push';

export type PushSubscriptionRepository = Repository<PushSubscriptionRecord, 'account_id' | 'endpoint'>;
