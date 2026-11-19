import type { IslandCode } from '../enums.js';

export interface ReferenceLocality { name: string; slug: string; island: IslandCode; lat: number; lng: number }

/**
 * Starter list of localities. Coordinates are APPROXIMATE (town centres, to ~1 km) and must be
 * checked against an authoritative source before launch (ticket SEARCH-01).
 */
export const REFERENCE_LOCALITIES: readonly ReferenceLocality[] = [
  // Ngazidja (Grande Comore)
  { name: 'Moroni', slug: 'moroni', island: 'NGAZIDJA', lat: -11.7022, lng: 43.2551 },
  { name: 'Iconi', slug: 'iconi', island: 'NGAZIDJA', lat: -11.75, lng: 43.2333 },
  { name: 'Itsandra', slug: 'itsandra', island: 'NGAZIDJA', lat: -11.6667, lng: 43.25 },
  { name: 'Ntsoudjini', slug: 'ntsoudjini', island: 'NGAZIDJA', lat: -11.65, lng: 43.2667 },
  { name: 'Mitsamiouli', slug: 'mitsamiouli', island: 'NGAZIDJA', lat: -11.3847, lng: 43.2844 },
  { name: 'Mbéni', slug: 'mbeni', island: 'NGAZIDJA', lat: -11.5, lng: 43.3833 },
  { name: 'Koimbani', slug: 'koimbani', island: 'NGAZIDJA', lat: -11.6222, lng: 43.3742 },
  { name: 'Mitsoudjé', slug: 'mitsoudje', island: 'NGAZIDJA', lat: -11.8131, lng: 43.2792 },
  { name: 'Dembéni', slug: 'dembeni', island: 'NGAZIDJA', lat: -11.8742, lng: 43.3975 },
  { name: 'Foumbouni', slug: 'foumbouni', island: 'NGAZIDJA', lat: -11.8658, lng: 43.4956 },
  // Ndzuani (Anjouan)
  { name: 'Mutsamudu', slug: 'mutsamudu', island: 'NDZUANI', lat: -12.1667, lng: 44.3994 },
  { name: 'Mirontsi', slug: 'mirontsi', island: 'NDZUANI', lat: -12.1553, lng: 44.4089 },
  { name: 'Ouani', slug: 'ouani', island: 'NDZUANI', lat: -12.1322, lng: 44.4278 },
  { name: 'Sima', slug: 'sima', island: 'NDZUANI', lat: -12.1956, lng: 44.2767 },
  { name: 'Tsémbéhou', slug: 'tsembehou', island: 'NDZUANI', lat: -12.2075, lng: 44.4683 },
  { name: 'Bambao', slug: 'bambao', island: 'NDZUANI', lat: -12.2, lng: 44.5167 },
  { name: 'Domoni', slug: 'domoni', island: 'NDZUANI', lat: -12.2569, lng: 44.5319 },
  { name: 'Moya', slug: 'moya', island: 'NDZUANI', lat: -12.3089, lng: 44.4372 },
  { name: 'Mramani', slug: 'mramani', island: 'NDZUANI', lat: -12.3456, lng: 44.5311 },
  // Mwali (Mohéli)
  { name: 'Fomboni', slug: 'fomboni', island: 'MWALI', lat: -12.28, lng: 43.7425 },
  { name: 'Djoiezi', slug: 'djoiezi', island: 'MWALI', lat: -12.3028, lng: 43.77 },
  { name: 'Wanani', slug: 'wanani', island: 'MWALI', lat: -12.3486, lng: 43.7972 },
  { name: 'Nioumachoua', slug: 'nioumachoua', island: 'MWALI', lat: -12.3625, lng: 43.7144 },
  { name: 'Hoani', slug: 'hoani', island: 'MWALI', lat: -12.2536, lng: 43.6739 },
  { name: 'Miringoni', slug: 'miringoni', island: 'MWALI', lat: -12.3, lng: 43.6392 },
];
