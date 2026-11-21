import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard, CurrentUser, PatientGuard } from '../auth/auth.guard.js';
import type { SessionUser } from '../auth/auth.types.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';
import { CurrentPharma, PharmaGuard, type PharmaMembership } from './pharma.guard.js';
import { PharmaService } from './pharma.service.js';
import { PharmaciesService } from './pharmacies.service.js';

const text = (max: number) => z.string().trim().max(max);
const Address = z.object({ line: text(200).min(3), localityId: z.uuid(), instructions: text(300).optional(), phone: text(30).min(6) });
const Delivery = z
  .object({ mode: z.enum(['PICKUP', 'DELIVERY']), address: Address.optional() })
  .refine((d) => d.mode === 'PICKUP' || !!d.address, { message: 'Address required for delivery', path: ['address'] });
const CreateOrder = z.intersection(
  Delivery,
  z.object({
    pharmacyId: z.uuid(),
    lines: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
    prescriptionId: z.uuid().optional(),
  }),
);
const Share = z.object({ pharmacyId: z.uuid() });
const Respond = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.uuid(),
        status: z.enum(['AVAILABLE', 'SUBSTITUTE', 'UNAVAILABLE']),
        productId: z.uuid().optional(),
        productName: text(200).optional(),
        unitPriceKmf: z.number().int().min(0).max(10_000_000).optional(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(30),
  readyInMinutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
  message: text(300).optional(),
});
const Status = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  courier: z.object({ name: text(80).min(2), phone: text(30).min(6) }).optional(),
  note: text(300).optional(),
});
const Availability = z.enum(['IN_STOCK', 'LOW', 'OUT_OF_STOCK', 'ON_ORDER']);
const Product = z.object({
  drugId: z.uuid().optional(),
  name: text(200).optional(),
  category: z.enum(['medication', 'parapharmacy', 'equipment']).default('medication'),
  priceKmf: z.number().int().min(0).max(10_000_000),
  availability: Availability.default('IN_STOCK'),
});
const ProductPatch = z.object({ priceKmf: z.number().int().min(0).max(10_000_000).optional(), availability: Availability.optional(), name: text(200).min(2).optional() });
const Import = z.object({ csv: z.string().max(500_000) });
const Profile = z.object({
  phone: text(30).optional(),
  description: text(1000).optional(),
  services: z.array(z.enum(['DELIVERY', 'PARAPHARMACY', 'MEDICAL_EQUIPMENT', 'NIGHT_BELL'])).max(10).optional(),
  paymentMethods: z.array(z.enum(['CASH', 'CARD', 'MVOLA', 'HURI'])).max(6).optional(),
  deliveryZones: z.array(z.object({ localityId: z.uuid(), feeKmf: z.number().int().min(0).max(100_000) })).max(60).optional(),
});
const DutyQuery = z.object({ island: z.enum(['ngazidja', 'ndzuani', 'mwali']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), week: z.enum(['1', 'true']).optional() });

@ApiTags('pharmacies')
@Controller('v1')
@RateLimit('publicRead')
@UseGuards(RateLimitGuard)
export class PublicPharmaciesController {
  constructor(private readonly pharmacies: PharmaciesService) {}

  @Get('pharmacies')
  @ApiQuery({ name: 'island', required: false })
  @ApiQuery({ name: 'locality', required: false })
  @ApiOperation({ summary: 'Annuaire des pharmacies (partenaires en premier, libellées).' })
  list(@Query('island') island?: string, @Query('locality') locality?: string) {
    return this.pharmacies.list({ island, locality });
  }

  @Get('pharmacies/on-duty')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Pharmacies de garde d’une île pour un jour (ou 7 jours avec week=1). Sans compte.' })
  onDuty(@Query(new ZodValidationPipe(DutyQuery)) q: z.infer<typeof DutyQuery>) {
    return this.pharmacies.onDuty({ island: q.island, date: q.date, week: !!q.week });
  }

  @Get('pharmacies/:slug')
  @ApiOperation({ summary: 'Profil public et catalogue d’une pharmacie.' })
  profile(@Param('slug') slug: string) {
    return this.pharmacies.profile(slug);
  }

  @Get('drugs/:slug/availability')
  @ApiOperation({ summary: 'Pharmacies qui proposent un médicament, avec prix indicatif. Aucun conseil médical.' })
  availability(@Param('slug') slug: string, @Query('island') island?: string) {
    return this.pharmacies.drugAvailability(slug, island);
  }
}

@ApiTags('me')
@Controller('v1/me')
@UseGuards(PatientGuard)
export class PatientOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @ApiOperation({ summary: 'Commande à une pharmacie (retrait ou livraison). Produits contrôlés refusés.' })
  create(@CurrentUser() u: SessionUser, @Body(new ZodValidationPipe(CreateOrder)) body: z.infer<typeof CreateOrder>) {
    return this.orders.create(u, body);
  }

  @Get('orders')
  list(@CurrentUser() u: SessionUser) {
    return this.orders.list(u);
  }

  @Get('orders/:id')
  one(@CurrentUser() u: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.one(u, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() u: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.cancel(u, id);
  }

  @Post('prescriptions/:id/shares')
  @ApiOperation({ summary: 'Envoyer une ordonnance numérique à une pharmacie.' })
  share(@CurrentUser() u: SessionUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Share)) body: z.infer<typeof Share>) {
    return this.orders.share(u, id, body.pharmacyId);
  }

  @Get('prescriptions/:id/shares')
  shares(@CurrentUser() u: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.shares(u, id);
  }

  @Post('prescription-shares/:id/accept')
  @ApiOperation({ summary: 'Accepter la réponse de la pharmacie : crée la commande des produits disponibles.' })
  accept(@CurrentUser() u: SessionUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Delivery)) body: z.infer<typeof Delivery>) {
    return this.orders.acceptShare(u, id, body);
  }
}

@ApiTags('pharma')
@Controller('v1/pharma')
export class PharmaMeController {
  constructor(private readonly pharma: PharmaService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Pharmacies auxquelles le compte connecté a accès.' })
  me(@CurrentUser() u: SessionUser) {
    return this.pharma.me(u.id).then((memberships) => ({ userId: u.id, email: u.email, memberships }));
  }
}

@ApiTags('pharma')
@Controller('v1/pharma/orgs/:orgId')
@UseGuards(PharmaGuard)
export class PharmaController {
  constructor(private readonly pharma: PharmaService) {}

  @Get('dashboard')
  dashboard(@CurrentPharma() m: PharmaMembership) {
    return this.pharma.dashboard(m);
  }

  @Get('prescriptions')
  @ApiOperation({ summary: 'Ordonnances reçues (lecture journalisée dans le dossier du patient).' })
  inbox(@CurrentPharma() m: PharmaMembership, @Query('status') status?: string) {
    return this.pharma.inbox(m, status);
  }

  @Post('prescriptions/:shareId/respond')
  @HttpCode(200)
  respond(@CurrentPharma() m: PharmaMembership, @Param('shareId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Respond)) body: z.infer<typeof Respond>) {
    return this.pharma.respond(m, id, body);
  }

  @Get('orders')
  orders(@CurrentPharma() m: PharmaMembership, @Query('scope') scope?: string) {
    return this.pharma.orderList(m, scope);
  }

  @Get('orders/:id')
  order(@CurrentPharma() m: PharmaMembership, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pharma.order(m, id);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  status(@CurrentPharma() m: PharmaMembership, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Status)) body: z.infer<typeof Status>) {
    return this.pharma.setStatus(m, id, body);
  }

  @Get('products')
  products(@CurrentPharma() m: PharmaMembership, @Query('q') q?: string) {
    return this.pharma.products(m, q ? String(q).slice(0, 60) : undefined);
  }

  @Post('products')
  createProduct(@CurrentPharma() m: PharmaMembership, @Body(new ZodValidationPipe(Product)) body: z.infer<typeof Product>) {
    return this.pharma.createProduct(m, body);
  }

  @Post('products/import')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import CSV : nom ; prix ; disponibilité ; catégorie ; médicament (slug).' })
  importProducts(@CurrentPharma() m: PharmaMembership, @Body(new ZodValidationPipe(Import)) body: z.infer<typeof Import>) {
    return this.pharma.importProducts(m, body.csv);
  }

  @Patch('products/:id')
  updateProduct(@CurrentPharma() m: PharmaMembership, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(ProductPatch)) body: z.infer<typeof ProductPatch>) {
    return this.pharma.updateProduct(m, id, body);
  }

  @Delete('products/:id')
  @HttpCode(204)
  deleteProduct(@CurrentPharma() m: PharmaMembership, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pharma.deleteProduct(m, id);
  }

  @Get('duty')
  duties(@CurrentPharma() m: PharmaMembership) {
    return this.pharma.duties(m);
  }

  @Get('profile')
  profile(@CurrentPharma() m: PharmaMembership) {
    return this.pharma.profile(m);
  }

  @Put('profile')
  updateProfile(@CurrentPharma() m: PharmaMembership, @Body(new ZodValidationPipe(Profile)) body: z.infer<typeof Profile>) {
    return this.pharma.updateProfile(m, body);
  }
}
