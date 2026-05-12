import { prisma } from '../prisma-client';

const PERMISSIONS = [
  { code: 'user:create',              description: 'Create bank staff users' },
  { code: 'user:read',               description: 'Read user records' },
  { code: 'user:update',             description: 'Update user records' },
  { code: 'role:manage',             description: 'Create and assign roles' },
  { code: 'customer:create',         description: 'Onboard new customer' },
  { code: 'customer:read',           description: 'View customer profile' },
  { code: 'customer:update',         description: 'Update customer KYC' },
  { code: 'account:open',            description: 'Open savings / current / FD account' },
  { code: 'account:read',            description: 'View account details' },
  { code: 'account:update',          description: 'Update account status (freeze, dormant, reactivate)' },
  { code: 'account:close',           description: 'Close account' },
  { code: 'loan:apply',              description: 'Submit loan application' },
  { code: 'loan:read',               description: 'View loan details and repayment schedule' },
  { code: 'loan:approve',            description: 'Approve / decline loan' },
  { code: 'loan:disburse',           description: 'Disburse approved loan' },
  { code: 'loan:repay',              description: 'Post loan repayment' },
  { code: 'loan:write-off',          description: 'Write off LOST loan' },
  { code: 'transaction:deposit',     description: 'OTC deposit' },
  { code: 'transaction:withdraw',    description: 'OTC withdrawal' },
  { code: 'transaction:transfer',    description: 'Intra-bank transfer' },
  { code: 'transaction:nip',         description: 'NIP inter-bank transfer' },
  { code: 'transaction:approve',     description: 'Approve maker-checker transactions' },
  { code: 'transaction:read',        description: 'View transaction history' },
  { code: 'report:read',             description: 'Generate statements and reports' },
  { code: 'document:upload',         description: 'Upload KYC documents' },
  { code: 'document:review',         description: 'Approve / reject KYC documents' },
  { code: 'document:read',           description: 'View documents' },
  { code: 'gl:read',                 description: 'View chart of accounts and balances' },
  { code: 'gl:manage',               description: 'Create / edit GL accounts' },
  { code: 'admin:read',              description: 'Read admin configuration (branches, products, GL, etc.)' },
  { code: 'admin:config',            description: 'Write admin configuration (branches, products, GL, etc.)' },
  { code: 'admin:products',          description: 'Manage products and rate bands' },
  { code: 'admin:branding',          description: 'Upload organisation logo' },
  { code: 'admin:tax-rates',         description: 'Manage tax rates' },
  { code: 'admin:transaction-types', description: 'Manage transaction type config' },
  { code: 'aml:freeze',              description: 'Freeze / unfreeze accounts' },
  { code: 'aml:str',                 description: 'File suspicious transaction report' },
  { code: 'baas:api-keys',           description: 'Manage BaaS API keys' },
  { code: 'baas:webhooks',           description: 'Manage BaaS webhooks' },
  { code: 'audit:read',              description: 'View audit logs' },
  { code: 'notification:send',       description: 'Trigger notifications' },
  { code: 'notification:read',       description: 'View notification logs' },
  { code: 'kyc:bvn-verify',          description: 'BVN verification via NIBSS' },
  { code: 'kyc:credit-check',        description: 'Credit bureau check' },
];

async function seedPermissions() {
  console.log(`Seeding ${PERMISSIONS.length} global permissions...`);
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { code: perm.code, description: perm.description },
    });
  }
  console.log('Permissions seed complete.');
}

async function main() {
  await seedPermissions();
}

main().catch(console.error).finally(() => prisma.$disconnect());
