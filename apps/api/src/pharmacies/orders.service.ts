import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type OrderPaymentMode } from '@prisma/client';
import { normalizePhone } from '@twabibu/utils';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { orderInclude, orderReference, orderView, type OrderAddress, type OrderRow, type ShareResponse } from './order-view.js';
import { cartProblem, deliveryFee, patientCanCancel, type DeliveryZone } from './pharmacy-rules.js';

export interface DeliveryInput {
  mode: 'PICKUP' | 'DELIVERY';
  address?: { line: string; localityId: string; instructions?: string; phone: string };
}

export interface CreateOrderInput extends DeliveryInput {
  pharmacyId: string;
  lines: { productId: string; quantity: number }[];
  prescriptionId?: string;
}

const CART_ERRORS = {
  CONTROLLED: 'CONTROLLED_PRODUCT_NOT_ORDERABLE',
  OUT_OF_STOCK: 'PRODUCT_UNAVAILABLE',
  PRESCRIPTION_REQUIRED: 'PRESCRIPTION_REQUIRED',
} as const;

/** Patient side of the pharmacy module (SPEC-15 §3-4): orders and prescriptions sent to a pharmacy. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Medical records the patient may act on: their own and their relatives'. */
  async patientRecordIds(user: SessionUser): Promise<string[]> {
    const relatives = await this.prisma.relative.findMany({ where: { patientProfileId: user.patientProfileId! }, select: { id: true } });
    const records = await this.prisma.medicalRecord.findMany({
      where: { OR: [{ patientProfileId: user.patientProfileId! }, { relativeId: { in: relatives.map((r) => r.id) } }] },
      select: { id: true },
    });
    return records.map((r) => r.id);
  }

  /** A signed, unexpired prescription of the patient, or 404. */
  private async validPrescription(user: SessionUser, prescriptionId: string) {
    const p = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, recordId: { in: await this.patientRecordIds(user) } },
      include: { lines: { orderBy: { sortOrder: 'asc' }, include: { drug: true } } },
    });
    if (!p) throw new ApiException('NOT_FOUND', 'Prescription not found');
    const usable = ['SIGNED', 'SENT_TO_PHARMACY', 'PARTIALLY_DISPENSED'].includes(p.status) && (!p.expiresAt || p.expiresAt > new Date());
    if (!usable) throw new ApiException('CONFLICT', 'Prescription expired, cancelled or already dispensed');
    return p;
  }

  private async orderablePharmacy(pharmacyId: string) {
    const profile = await this.prisma.pharmacyProfile.findUnique({ where: { organizationId: pharmacyId }, include: { organization: true } });
    if (!profile || profile.organization.type !== 'PHARMACY' || profile.organization.status === 'SUSPENDED') throw new ApiException('NOT_FOUND', 'Pharmacy not found');
    // An unverified pharmacy is listed but takes neither orders nor prescriptions (SPEC-15 §7.1).
    if (!profile.verifiedAt) throw new ApiException('PHARMACY_NOT_VERIFIED', 'Pharmacy not verified');
    return profile;
  }

  /** Delivery fee and stored address, or a typed error. Controlled products are counter-only. */
  private async delivery(profile: { services: string[]; deliveryZones: Prisma.JsonValue }, input: DeliveryInput, hasControlled: boolean) {
    if (input.mode === 'PICKUP') return { fee: 0, address: null, payment: 'AT_PICKUP' as OrderPaymentMode };
    if (hasControlled) throw new ApiException('CONTROLLED_PRODUCT_NOT_ORDERABLE', 'Controlled products are collected at the counter');
    if (!input.address) throw new ApiException('VALIDATION_FAILED', 'Delivery address required');
    const fee = profile.services.includes('DELIVERY') ? deliveryFee(profile.deliveryZones as unknown as DeliveryZone[], input.address.localityId) : null;
    if (fee === null) throw new ApiException('DELIVERY_NOT_AVAILABLE', 'No delivery to this locality');
    const phone = normalizePhone(input.address.phone);
    if (!phone) throw new ApiException('VALIDATION_FAILED', 'Invalid phone number', { field: 'address.phone' });
    const locality = await this.prisma.locality.findUniqueOrThrow({ where: { id: input.address.localityId } });
    const address: OrderAddress = { line: input.address.line, localityId: locality.id, locality: locality.name, instructions: input.address.instructions, phone };
    return { fee, address, payment: 'CASH_ON_DELIVERY' as OrderPaymentMode };
  }

  async create(user: SessionUser, input: CreateOrderInput) {
    const profile = await this.orderablePharmacy(input.pharmacyId);
    const prescription = input.prescriptionId ? await this.validPrescription(user, input.prescriptionId) : null;
    const prescribed = new Set((prescription?.lines ?? []).map((l) => l.drugId).filter((id): id is string => !!id));
    const ids = [...new Set(input.lines.map((l) => l.productId))];
    if (ids.length !== input.lines.length) throw new ApiException('VALIDATION_FAILED', 'Duplicate product');
    const products = await this.prisma.pharmacyProduct.findMany({ where: { id: { in: ids }, pharmacyId: profile.organizationId } });
    if (products.length !== ids.length) throw new ApiException('PRODUCT_UNAVAILABLE', 'Unknown product for this pharmacy');
    for (const p of products) {
      const problem = cartProblem(p, prescribed);
      if (problem) throw new ApiException(CART_ERRORS[problem], `Product ${p.id} cannot be ordered online`, { productId: p.id });
    }
    const { fee, address, payment } = await this.delivery(profile, input, false);
    const lines = input.lines.map((l) => {
      const p = products.find((x) => x.id === l.productId)!;
      return { productId: p.id, label: p.name, quantity: l.quantity, unitPriceKmf: p.priceKmf };
    });
    const order = await this.prisma.order.create({
      data: {
        pharmacyId: profile.organizationId,
        patientProfileId: user.patientProfileId,
        prescriptionId: prescription?.id ?? null,
        mode: input.mode,
        address: address ? (address as unknown as Prisma.InputJsonValue) : undefined,
        paymentMode: payment,
        subtotalKmf: lines.reduce((s, l) => s + l.quantity * l.unitPriceKmf, 0),
        deliveryFeeKmf: fee,
        lines: { create: lines },
        events: { create: { status: 'PENDING', actorUserId: user.id } },
      },
      include: orderInclude,
    });
    await this.afterCreate(order, user);
    return orderView(order);
  }

  private async afterCreate(order: OrderRow, user: SessionUser) {
    await this.notifyPatient(order, user.id);
    const org = order.pharmacy.organization;
    if (org.email) {
      await this.notifications.sendEmail({
        to: org.email,
        template: 'pharmacyNewRequest',
        email: emailTemplates.pharmacyNewRequest({ pharmacyName: org.name, kind: 'ORDER', url: `${this.config.APP_URL}/pharma/app/commandes` }),
        orderId: order.id,
      });
    }
  }

  /** E-mail to the patient for the current status of the order. */
  async notifyPatient(order: OrderRow, userId?: string) {
    if (!order.patientProfileId) return;
    const profile = await this.prisma.patientProfile.findUnique({ where: { id: order.patientProfileId }, include: { user: true } });
    if (!profile?.user.email) return;
    const view = orderView(order);
    await this.notifications.sendEmail({
      to: profile.user.email,
      userId: userId ?? profile.userId,
      template: 'orderStatus',
      email: emailTemplates.orderStatus({
        firstName: profile.firstName,
        pharmacyName: view.pharmacy.name,
        pharmacyAddress: view.pharmacy.address,
        reference: orderReference(order.id),
        status: order.status,
        courier: view.courier,
        url: `${this.config.APP_URL}/mon-compte/commandes/${order.id}`,
      }),
      orderId: order.id,
    });
  }

  async list(user: SessionUser) {
    const rows = await this.prisma.order.findMany({ where: { patientProfileId: user.patientProfileId! }, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map(orderView);
  }

  async one(user: SessionUser, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, patientProfileId: user.patientProfileId! }, include: orderInclude });
    if (!o) throw new ApiException('NOT_FOUND', 'Order not found');
    return orderView(o);
  }

  async cancel(user: SessionUser, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, patientProfileId: user.patientProfileId! } });
    if (!o) throw new ApiException('NOT_FOUND', 'Order not found');
    if (!patientCanCancel(o.status)) throw new ApiException('ORDER_STATUS_INVALID', 'The pharmacy is already preparing this order');
    const done = await this.prisma.order.updateMany({ where: { id, status: o.status }, data: { status: 'CANCELLED' } });
    if (!done.count) throw new ApiException('ORDER_STATUS_INVALID', 'Order changed meanwhile');
    await this.prisma.orderEvent.create({ data: { orderId: id, status: 'CANCELLED', actorUserId: user.id, note: 'Annulée par le patient' } });
    return this.one(user, id);
  }

  /** The patient sends a digital prescription to a pharmacy: it lands in its inbox (SPEC-15 §3). */
  async share(user: SessionUser, prescriptionId: string, pharmacyId: string) {
    const p = await this.validPrescription(user, prescriptionId);
    const profile = await this.orderablePharmacy(pharmacyId);
    const existing = await this.prisma.prescriptionShare.findUnique({ where: { prescriptionId_pharmacyId: { prescriptionId, pharmacyId } } });
    if (existing && existing.status !== 'DECLINED') throw new ApiException('CONFLICT', 'Already sent to this pharmacy');
    const share = existing
      ? await this.prisma.prescriptionShare.update({ where: { id: existing.id }, data: { status: 'SENT', response: Prisma.DbNull, answeredAt: null, sentAt: new Date() } })
      : await this.prisma.prescriptionShare.create({ data: { prescriptionId, pharmacyId } });
    if (p.status === 'SIGNED') await this.prisma.prescription.update({ where: { id: p.id }, data: { status: 'SENT_TO_PHARMACY' } });
    if (profile.organization.email) {
      await this.notifications.sendEmail({
        to: profile.organization.email,
        template: 'pharmacyNewRequest',
        email: emailTemplates.pharmacyNewRequest({ pharmacyName: profile.organization.name, kind: 'PRESCRIPTION', url: `${this.config.APP_URL}/pharma/app/ordonnances` }),
      });
    }
    return { id: share.id, status: share.status };
  }

  /** Where the prescription was sent and what each pharmacy answered. */
  async shares(user: SessionUser, prescriptionId: string) {
    const p = await this.prisma.prescription.findFirst({ where: { id: prescriptionId, recordId: { in: await this.patientRecordIds(user) } } });
    if (!p) throw new ApiException('NOT_FOUND', 'Prescription not found');
    const rows = await this.prisma.prescriptionShare.findMany({ where: { prescriptionId }, orderBy: { sentAt: 'desc' } });
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: rows.map((r) => r.pharmacyId) } }, select: { id: true, name: true, slug: true, phone: true } });
    const orders = await this.prisma.order.findMany({ where: { prescriptionId, patientProfileId: user.patientProfileId! }, select: { id: true, pharmacyId: true, status: true } });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      sentAt: r.sentAt.toISOString(),
      answeredAt: r.answeredAt?.toISOString() ?? null,
      pharmacy: orgs.find((o) => o.id === r.pharmacyId)!,
      response: (r.response as ShareResponse | null) ?? null,
      order: orders.find((o) => o.pharmacyId === r.pharmacyId && o.status !== 'CANCELLED') ?? null,
    }));
  }

  /** The patient accepts the pharmacy's answer: the available lines become an order. */
  async acceptShare(user: SessionUser, shareId: string, input: DeliveryInput) {
    const share = await this.prisma.prescriptionShare.findUnique({ where: { id: shareId } });
    if (!share) throw new ApiException('NOT_FOUND', 'Request not found');
    await this.validPrescription(user, share.prescriptionId); // ownership + still valid
    if (share.status !== 'ANSWERED') throw new ApiException('CONFLICT', 'The pharmacy has not answered yet or the request is closed');
    const profile = await this.orderablePharmacy(share.pharmacyId);
    const response = share.response as unknown as ShareResponse;
    const kept = response.lines.filter((l) => l.status !== 'UNAVAILABLE' && l.unitPriceKmf !== null);
    if (!kept.length) throw new ApiException('PRODUCT_UNAVAILABLE', 'Nothing available');
    const { fee, address, payment } = await this.delivery(profile, input, kept.some((l) => l.controlled));
    const accepted = await this.prisma.prescriptionShare.updateMany({ where: { id: shareId, status: 'ANSWERED' }, data: { status: 'ACCEPTED' } });
    if (!accepted.count) throw new ApiException('CONFLICT', 'Already accepted');
    const order = await this.prisma.order.create({
      data: {
        pharmacyId: share.pharmacyId,
        patientProfileId: user.patientProfileId,
        prescriptionId: share.prescriptionId,
        mode: input.mode,
        address: address ? (address as unknown as Prisma.InputJsonValue) : undefined,
        paymentMode: payment,
        subtotalKmf: kept.reduce((s, l) => s + l.quantity * l.unitPriceKmf!, 0),
        deliveryFeeKmf: fee,
        lines: { create: kept.map((l) => ({ productId: l.productId, label: l.productName ?? l.label, quantity: l.quantity, unitPriceKmf: l.unitPriceKmf! })) },
        events: { create: { status: 'PENDING', actorUserId: user.id, note: 'Commande issue de l’ordonnance' } },
      },
      include: orderInclude,
    });
    await this.afterCreate(order, user);
    return orderView(order);
  }
}
