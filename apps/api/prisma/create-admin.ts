/**
 * Creates or updates a back-office account (production included). The person then signs in on the admin
 * app with the e-mail code and scans the authenticator QR code on first sign-in.
 *   pnpm --filter @twabibu/api admin:create prenom.nom@twabibu.km SUPERADMIN
 *   pnpm --filter @twabibu/api admin:create support@twabibu.km SUPPORT,VERIFIER
 */
import { PrismaClient } from '@prisma/client';

const ROLES = ['SUPERADMIN', 'VERIFIER', 'SUPPORT', 'FINANCE'];
const [email, roleList = ''] = process.argv.slice(2);
const roles = roleList.split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !roles.length || roles.some((r) => !ROLES.includes(r))) {
  console.error(`Usage: admin:create <e-mail> <${ROLES.join('|')}>[,…]`);
  process.exit(1);
}

const prisma = new PrismaClient();
const address = email.toLowerCase();
const existing = await prisma.user.findUnique({ where: { email: address } });
if (existing && existing.kind !== 'PLATFORM_ADMIN') {
  console.error('This e-mail belongs to a patient or professional account: use a dedicated address for the back-office.');
  process.exit(1);
}
await prisma.user.upsert({
  where: { email: address },
  update: { adminRoles: roles },
  create: { email: address, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles: roles },
});
console.log(`Back-office account ready: ${address} (${roles.join(', ')})`);
await prisma.$disconnect();
