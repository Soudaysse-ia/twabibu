import type { Prisma } from '@prisma/client';

export const orderInclude = {
  lines: { include: { product: { select: { controlled: true } } } },
  events: { orderBy: { createdAt: 'asc' } },
  pharmacy: { include: { organization: { include: { practices: { include: { locality: true }, take: 1, orderBy: { createdAt: 'asc' } } } } } },
} satisfies Prisma.OrderInclude;

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export interface OrderAddress {
  line: string;
  localityId: string;
  locality: string;
  instructions?: string;
  phone: string;
}

/** Short reference read over the phone: last 6 characters of the id. */
export const orderReference = (id: string) => id.replace(/-/g, '').slice(-6).toUpperCase();

export function orderView(o: OrderRow) {
  const org = o.pharmacy.organization;
  const practice = org.practices[0];
  return {
    id: o.id,
    reference: orderReference(o.id),
    status: o.status,
    mode: o.mode,
    paymentMode: o.paymentMode,
    subtotalKmf: o.subtotalKmf,
    deliveryFeeKmf: o.deliveryFeeKmf,
    totalKmf: o.subtotalKmf + o.deliveryFeeKmf,
    address: (o.address as OrderAddress | null) ?? null,
    courier: (o.courier as { name: string; phone: string } | null) ?? null,
    prescriptionId: o.prescriptionId,
    createdAt: o.createdAt.toISOString(),
    pharmacy: { id: org.id, slug: org.slug, name: org.name, phone: org.phone, address: practice ? `${practice.addressLine}, ${practice.locality.name}` : '' },
    lines: o.lines.map((l) => ({ id: l.id, label: l.label, quantity: l.quantity, unitPriceKmf: l.unitPriceKmf, totalKmf: l.quantity * l.unitPriceKmf })),
    events: o.events.map((e) => ({ status: e.status, note: e.note, at: e.createdAt.toISOString() })),
  };
}

export type OrderView = ReturnType<typeof orderView>;

/** Response of a pharmacy to a prescription (stored on PrescriptionShare.response). */
export interface ShareResponse {
  lines: {
    lineId: string;
    label: string;
    status: 'AVAILABLE' | 'SUBSTITUTE' | 'UNAVAILABLE';
    productId: string | null;
    productName: string | null;
    unitPriceKmf: number | null;
    quantity: number;
    controlled: boolean;
  }[];
  readyInMinutes: number | null;
  message: string | null;
  totalKmf: number;
}
