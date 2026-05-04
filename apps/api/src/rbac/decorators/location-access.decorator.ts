import { SetMetadata } from '@nestjs/common';

export const LOCATION_ACCESS_KEY = 'locationAccess';

export type LocationAccessSource = 'body' | 'query' | 'params';

export interface LocationAccessRequirement {
  source: LocationAccessSource;
  key: string;
}

export const LocationAccess = (...requirements: LocationAccessRequirement[]) =>
  SetMetadata(LOCATION_ACCESS_KEY, requirements);
