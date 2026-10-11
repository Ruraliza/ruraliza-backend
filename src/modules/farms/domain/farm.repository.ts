import type { Repository } from '#shared/domain/repository';
import type { Farm } from '../farm.contract';

export type FarmRepository = Repository<Farm, 'farmer_id'>;
