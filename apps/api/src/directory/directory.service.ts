import { Injectable } from '@nestjs/common';
import type { Locality, Speciality } from '@twabibu/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async islands() {
    return this.prisma.island.findMany({ orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, frenchName: true, slug: true } });
  }

  async localities(island?: string): Promise<Locality[]> {
    const rows = await this.prisma.locality.findMany({
      where: { isActive: true, ...(island ? { island: { slug: island } } : {}) },
      include: { island: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((l) => ({ id: l.id, name: l.name, slug: l.slug, island: l.island.code, lat: l.lat, lng: l.lng }));
  }

  async specialities(): Promise<Speciality[]> {
    const rows = await this.prisma.speciality.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map((s) => ({ id: s.id, name: s.name, slug: s.slug, group: s.group, canPrescribe: s.canPrescribe }));
  }
}
