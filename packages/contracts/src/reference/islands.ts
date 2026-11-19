import type { IslandCode } from '../enums.js';

export interface ReferenceIsland { code: IslandCode; name: string; frenchName: string; slug: string }

export const REFERENCE_ISLANDS: readonly ReferenceIsland[] = [
  { code: 'NGAZIDJA', name: 'Ngazidja', frenchName: 'Grande Comore', slug: 'ngazidja' },
  { code: 'NDZUANI', name: 'Ndzuani', frenchName: 'Anjouan', slug: 'ndzuani' },
  { code: 'MWALI', name: 'Mwali', frenchName: 'Mohéli', slug: 'mwali' },
];
