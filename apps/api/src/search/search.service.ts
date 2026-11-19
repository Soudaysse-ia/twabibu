import { Injectable } from '@nestjs/common';
import { searchKey } from '@twabibu/utils';
import { PrismaService } from '../prisma/prisma.service.js';

export interface Suggestions {
  specialities: { slug: string; name: string }[];
  practitioners: { slug: string; name: string; speciality: string; locality: string }[];
}

export interface PlaceSuggestions {
  islands: { slug: string; name: string; frenchName: string }[];
  localities: { slug: string; name: string; island: string }[];
}

/**
 * Autocomplete for the two search fields (SPEC-01 §1–2).
 * Accent- and case-insensitive through `unaccent`; the trigram indexes keep it fast.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string): Promise<Suggestions> {
    const term = searchKey(q);
    if (term.length < 2) return { specialities: [], practitioners: [] };
    const like = `%${term}%`;
    const prefix = `${term}%`;
    const [specialities, practitioners] = await Promise.all([
      this.prisma.$queryRaw<{ slug: string; name: string }[]>`
        SELECT slug, name FROM "Speciality"
        WHERE "isActive" AND unaccent(lower(name)) LIKE ${like}
        ORDER BY (unaccent(lower(name)) LIKE ${prefix}) DESC, "sortOrder", name
        LIMIT 6`,
      this.prisma.$queryRaw<{ slug: string; name: string; speciality: string; locality: string }[]>`
        SELECT p.slug,
               trim(coalesce(p.title || ' ', '') || p."firstName" || ' ' || p."lastName") AS name,
               s.name AS speciality,
               coalesce(min(l.name), '') AS locality
        FROM "Practitioner" p
        JOIN "Speciality" s ON s.id = p."specialityId"
        LEFT JOIN "PractitionerPractice" pp ON pp."practitionerId" = p.id
        LEFT JOIN "Practice" pr ON pr.id = pp."practiceId"
        LEFT JOIN "Locality" l ON l.id = pr."localityId"
        WHERE p."isPublished" AND p."verificationStatus" = 'VERIFIED' AND p."deletedAt" IS NULL
          AND unaccent(lower(p."firstName" || ' ' || p."lastName")) LIKE ${like}
        GROUP BY p.id, s.name
        ORDER BY p."lastName"
        LIMIT 5`,
    ]);
    return { specialities, practitioners };
  }

  async places(q: string): Promise<PlaceSuggestions> {
    const term = searchKey(q);
    if (term.length < 2) return { islands: [], localities: [] };
    const like = `%${term}%`;
    const prefix = `${term}%`;
    const [islands, localities] = await Promise.all([
      this.prisma.$queryRaw<{ slug: string; name: string; frenchName: string }[]>`
        SELECT slug, name, "frenchName" FROM "Island"
        WHERE unaccent(lower(name)) LIKE ${like} OR unaccent(lower("frenchName")) LIKE ${like}
        ORDER BY name LIMIT 3`,
      this.prisma.$queryRaw<{ slug: string; name: string; island: string }[]>`
        SELECT l.slug, l.name, i.name AS island FROM "Locality" l JOIN "Island" i ON i.id = l."islandId"
        WHERE l."isActive" AND unaccent(lower(l.name)) LIKE ${like}
        ORDER BY (unaccent(lower(l.name)) LIKE ${prefix}) DESC, l.name LIMIT 8`,
    ]);
    return { islands, localities };
  }
}
