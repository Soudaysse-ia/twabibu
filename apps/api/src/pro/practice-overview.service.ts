import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDaysToDateKey, searchKey, toDateKey, zonedToUtc } from '@twabibu/utils';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OPEN_STATUSES, summarizeDay } from './day-summary.js';
import { canViewAgenda, type MembershipContext } from './permissions.js';

export const PATIENTS_PAGE_SIZE = 30;
const ACTIVE = OPEN_STATUSES;
const CANCELLED = ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE'] as const;

const ageOf = (birthDate: Date | null, now = new Date()) => {
  if (!birthDate) return null;
  let years = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) years--;
  return years;
};

/**
 * Practitioner's home and patient list (SPEC-05/06). Administrative data only: no medical field is read here,
 * so the secretary can use these screens and nothing is written to the record access log.
 */
@Injectable()
export class PracticeOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  /** Agendas shown: the practitioner's own agenda(s) when they have one, otherwise every agenda they may see. */
  private async scopeAgendas(m: MembershipContext, scope: 'mine' | 'all') {
    const all = (await this.prisma.agenda.findMany({ where: { practitioner: { organizationId: m.organizationId, deletedAt: null } }, select: { id: true, practitionerId: true } })).filter((a) => canViewAgenda(m, a));
    const mine = all.filter((a) => a.practitionerId === m.practitionerId);
    return scope === 'mine' && mine.length ? mine.map((a) => a.id) : all.map((a) => a.id);
  }

  async dashboard(m: MembershipContext, now = new Date()) {
    const agendaIds = await this.scopeAgendas(m, 'mine');
    const today = toDateKey(now);
    const [dayStart, dayEnd, weekEnd, monthAgo] = [zonedToUtc(today, 0), zonedToUtc(addDaysToDateKey(today, 1), 0), zonedToUtc(addDaysToDateKey(today, 8), 0), zonedToUtc(addDaysToDateKey(today, -30), 0)];
    const inScope: Prisma.AppointmentWhereInput = { agendaId: { in: agendaIds } };
    const [todayRows, pending, week, last30, recent] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...inScope, startsAt: { gte: dayStart, lt: dayEnd }, status: { notIn: [...CANCELLED] } },
        include: { motive: { select: { name: true, color: true } }, patientRecord: { select: { id: true, firstName: true, lastName: true, birthDate: true, noShowCount: true } }, agenda: { select: { practitioner: { select: { title: true, firstName: true, lastName: true } } } } },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: { ...inScope, status: 'PENDING_VALIDATION', startsAt: { gte: now } },
        include: { patientRecord: { select: { id: true, firstName: true, lastName: true } }, motive: { select: { name: true } } },
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
      this.prisma.appointment.count({ where: { ...inScope, startsAt: { gte: dayEnd, lt: weekEnd }, status: { in: [...ACTIVE] } } }),
      this.prisma.appointment.groupBy({ by: ['status', 'source'], where: { ...inScope, startsAt: { gte: monthAgo, lt: dayStart } }, _count: true }),
      this.prisma.appointment.findMany({
        where: { ...inScope, status: 'DONE', startsAt: { lt: now } },
        distinct: ['patientRecordId'],
        include: { patientRecord: { select: { id: true, firstName: true, lastName: true, birthDate: true } } },
        orderBy: { startsAt: 'desc' },
        take: 6,
      }),
    ]);
    const total30 = last30.filter((g) => !(CANCELLED as readonly string[]).includes(g.status)).reduce((s, g) => s + g._count, 0);
    const sum = (f: (g: (typeof last30)[number]) => boolean) => last30.filter(f).reduce((s, g) => s + g._count, 0);
    const day = summarizeDay(todayRows, now);
    const toClose = new Set(day.toClose);
    return {
      date: today,
      today: {
        total: todayRows.length,
        done: todayRows.filter((a) => a.status === 'DONE').length,
        remaining: day.remaining,
        toClose: toClose.size,
        noShow: todayRows.filter((a) => a.status === 'NO_SHOW').length,
        items: todayRows.map((a) => ({
          id: a.id,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          status: a.status,
          toClose: toClose.has(a.id),
          source: a.source,
          motive: a.motive.name,
          color: a.motive.color,
          confirmedByPatient: !!a.confirmedByPatientAt,
          practitioner: practitionerName(a.agenda.practitioner),
          patient: { id: a.patientRecord.id, name: `${a.patientRecord.firstName} ${a.patientRecord.lastName}`, age: ageOf(a.patientRecord.birthDate, now), noShowCount: a.patientRecord.noShowCount },
        })),
      },
      nextAppointmentId: day.next?.id ?? null,
      pending: pending.map((a) => ({ id: a.id, startsAt: a.startsAt.toISOString(), motive: a.motive.name, patient: { id: a.patientRecord.id, name: `${a.patientRecord.firstName} ${a.patientRecord.lastName}` } })),
      nextSevenDays: week,
      last30Days: { appointments: total30, noShows: sum((g) => g.status === 'NO_SHOW'), online: sum((g) => g.source === 'ONLINE' && !(CANCELLED as readonly string[]).includes(g.status)) },
      recentPatients: recent.map((a) => ({ id: a.patientRecord.id, name: `${a.patientRecord.firstName} ${a.patientRecord.lastName}`, age: ageOf(a.patientRecord.birthDate, now), lastVisitAt: a.startsAt.toISOString() })),
    };
  }

  /**
   * Patient list. `mine`: patients seen or booked on the practitioner's agenda, most recent first.
   * `all`: every file of the practice, alphabetical. Optional search by name, e-mail or phone digits.
   */
  async patients(m: MembershipContext, input: { scope: 'mine' | 'all'; q: string; page: number }) {
    const term = searchKey(input.q);
    const digits = input.q.replace(/\D/g, '');
    const search: Prisma.PatientRecordWhereInput =
      term.length >= 2 || digits.length >= 3
        ? {
            OR: [
              { lastName: { contains: term, mode: 'insensitive' } },
              { firstName: { contains: term, mode: 'insensitive' } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
              ...(input.q.includes('@') ? [{ email: { contains: input.q.trim().toLowerCase() } }] : []),
            ],
          }
        : {};
    const base: Prisma.PatientRecordWhereInput = { organizationId: m.organizationId, deletedAt: null, mergedIntoId: null, ...search };
    const skip = (input.page - 1) * PATIENTS_PAGE_SIZE;
    let ids: string[];
    let total: number;
    if (input.scope === 'mine') {
      const agendaIds = await this.scopeAgendas(m, 'mine');
      const where: Prisma.AppointmentWhereInput = { agendaId: { in: agendaIds }, patientRecord: base };
      const groups = await this.prisma.appointment.groupBy({ by: ['patientRecordId'], where, _max: { startsAt: true }, orderBy: { _max: { startsAt: 'desc' } }, skip, take: PATIENTS_PAGE_SIZE });
      total = (await this.prisma.appointment.groupBy({ by: ['patientRecordId'], where })).length;
      ids = groups.map((g) => g.patientRecordId);
    } else {
      [total, ids] = await Promise.all([
        this.prisma.patientRecord.count({ where: base }),
        this.prisma.patientRecord.findMany({ where: base, select: { id: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip, take: PATIENTS_PAGE_SIZE }).then((r) => r.map((x) => x.id)),
      ]);
    }
    const now = new Date();
    const rows = await this.prisma.patientRecord.findMany({
      where: { id: { in: ids } },
      include: {
        appointments: { where: { status: { notIn: [...CANCELLED] } }, select: { startsAt: true, status: true }, orderBy: { startsAt: 'asc' } },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      total,
      page: input.page,
      pageSize: PATIENTS_PAGE_SIZE,
      items: ids
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => {
          const past = r.appointments.filter((a) => a.startsAt < now && a.status !== 'NO_SHOW');
          const next = r.appointments.find((a) => a.startsAt >= now && (ACTIVE as readonly string[]).includes(a.status));
          return {
            id: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
            age: ageOf(r.birthDate, now),
            birthDate: r.birthDate?.toISOString().slice(0, 10) ?? null,
            phone: r.phone,
            email: r.email,
            hasAccount: r.patientProfileId !== null,
            noShowCount: r.noShowCount,
            isBlocked: r.isBlocked,
            visits: past.length,
            lastVisitAt: past.at(-1)?.startsAt.toISOString() ?? null,
            nextAppointmentAt: next?.startsAt.toISOString() ?? null,
          };
        }),
    };
  }

  /** Administrative side of a patient file: contact and appointments on the agendas this member may see. */
  async patient(m: MembershipContext, recordId: string) {
    const r = await this.prisma.patientRecord.findFirst({ where: { id: recordId, organizationId: m.organizationId, deletedAt: null } });
    if (!r) throw new ApiException('NOT_FOUND', 'Patient not found');
    const agendaIds = await this.scopeAgendas(m, 'all');
    const appointments = await this.prisma.appointment.findMany({
      where: { patientRecordId: r.id, agendaId: { in: agendaIds } },
      include: { motive: { select: { name: true } }, agenda: { select: { practitioner: { select: { title: true, firstName: true, lastName: true } } } } },
      orderBy: { startsAt: 'desc' },
      take: 100,
    });
    const now = new Date();
    return {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      birthDate: r.birthDate?.toISOString().slice(0, 10) ?? null,
      age: ageOf(r.birthDate, now),
      phone: r.phone,
      email: r.email,
      hasAccount: r.patientProfileId !== null,
      noShowCount: r.noShowCount,
      isBlocked: r.isBlocked,
      canOpenRecord: !!m.practitionerId,
      appointments: appointments.map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
        motive: a.motive.name,
        practitioner: practitionerName(a.agenda.practitioner),
        upcoming: a.startsAt >= now,
      })),
    };
  }
}
