/**
 * Idempotent patch: ensures every existing SUPER_ADMIN role has all currently
 * seeded permissions. Safe to re-run; uses skipDuplicates.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx ts-node scripts/patch-grant-missing-permissions.ts
 */
import { prisma } from './prisma-client';

async function main() {
  const allPermissions = await prisma.permission.findMany();
  const superAdminRoles = await prisma.role.findMany({ where: { name: 'SUPER_ADMIN' } });

  if (superAdminRoles.length === 0) {
    console.log('No SUPER_ADMIN roles found — nothing to patch.');
    return;
  }

  for (const role of superAdminRoles) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`Patched ${allPermissions.length} permissions → role ${role.id} (${role.name})`);
  }

  console.log('Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
