/**
 * Onboards a new tenant (bank/MFB) into the system.
 *
 * Usage:
 *   DATABASE_URL=postgres://... ts-node scripts/onboard-tenant.ts \
 *     --name "First Example Bank" \
 *     --shortName "FEB" \
 *     --tenantCode "FEB001" \
 *     --sortCode "000123" \
 *     --email "admin@feb.com" \
 *     --password "SecureP@ss1"
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

function arg(flag: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) throw new Error(`Missing ${flag}`);
  return process.argv[idx + 1];
}

async function main() {
  const name       = arg('--name');
  const shortName  = arg('--shortName');
  const tenantCode = arg('--tenantCode');
  const sortCode   = arg('--sortCode');
  const email      = arg('--email');
  const password   = arg('--password');

  // 1. Create organisation
  const org = await prisma.organisation.create({
    data: { name, shortName, tenantCode, sortCode, isActive: true },
  });
  const tenantId = org.id;
  console.log(`Organisation created: ${tenantId} — ${org.name}`);

  // 2. Seed GL accounts
  execSync(`SEED_TENANT_ID=${tenantId} npx ts-node scripts/seeds/gl.seed.ts`, { stdio: 'inherit' });

  // 3. Seed global permissions (idempotent)
  execSync(`npx ts-node scripts/seeds/permissions.seed.ts`, { stdio: 'inherit' });

  // 4. Seed transaction type configs
  execSync(`SEED_TENANT_ID=${tenantId} npx ts-node scripts/seeds/transaction-types.seed.ts`, { stdio: 'inherit' });

  // 5. Create SUPER_ADMIN role
  const role = await prisma.role.create({
    data: { tenantId, name: 'SUPER_ADMIN' },
  });
  console.log(`Role created: ${role.id} — ${role.name}`);

  // 6. Connect all permissions to the role via RolePermission
  const permissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  });
  console.log(`Granted ${permissions.length} permissions to ${role.name}`);

  // 7. Create super admin user
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      mustChangePassword: false,
    },
  });

  // 8. Assign role to user
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  console.log(`Admin user created: ${user.id} — ${user.email}`);
  console.log('\n=== Tenant onboarded successfully ===');
  console.log(`Tenant ID   : ${tenantId}`);
  console.log(`Tenant Code : ${tenantCode}`);
  console.log(`Sort Code   : ${sortCode}`);
  console.log(`Admin Email : ${email}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
