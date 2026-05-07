import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRANSACTION_TYPES = [
  { code: 'OTC_DEPOSIT',      name: 'OTC Deposit',           category: 'OTC_DEPOSIT',      flatFee: '0',   vatApplicable: false, requiresApprovalAbove: null },
  { code: 'OTC_WITHDRAWAL',   name: 'OTC Withdrawal',        category: 'OTC_WITHDRAWAL',   flatFee: '100', vatApplicable: true,  requiresApprovalAbove: null },
  { code: 'INTRA_TRANSFER',   name: 'Intra-Bank Transfer',   category: 'INTRA_TRANSFER',   flatFee: '0',   vatApplicable: false, requiresApprovalAbove: null },
  { code: 'NIP_TRANSFER',     name: 'NIP Transfer',          category: 'NIP_TRANSFER',     flatFee: '0',   vatApplicable: true,  requiresApprovalAbove: '500000' },
  { code: 'LOAN_DISBURSEMENT',name: 'Loan Disbursement',     category: 'LOAN_DISBURSEMENT',flatFee: '0',   vatApplicable: false, requiresApprovalAbove: '0' },
  { code: 'LOAN_REPAYMENT',   name: 'Loan Repayment',        category: 'LOAN_REPAYMENT',   flatFee: '0',   vatApplicable: false, requiresApprovalAbove: null },
  { code: 'FD_PLACEMENT',     name: 'FD Placement',          category: 'FD_PLACEMENT',     flatFee: '0',   vatApplicable: false, requiresApprovalAbove: null },
  { code: 'FD_LIQUIDATION',   name: 'FD Liquidation',        category: 'FD_LIQUIDATION',   flatFee: '0',   vatApplicable: false, requiresApprovalAbove: null },
  { code: 'ADJUSTMENT',       name: 'Manual Adjustment',     category: 'ADJUSTMENT',       flatFee: '0',   vatApplicable: false, requiresApprovalAbove: '0' },
];

async function seedTransactionTypes(tenantId: string) {
  console.log(`Seeding ${TRANSACTION_TYPES.length} transaction type configs for tenant ${tenantId}...`);
  for (const tt of TRANSACTION_TYPES) {
    await prisma.transactionTypeConfig.upsert({
      where: { tenantId_code: { tenantId, code: tt.code } },
      update: { name: tt.name, flatFee: tt.flatFee, vatApplicable: tt.vatApplicable, requiresApprovalAbove: tt.requiresApprovalAbove },
      create: {
        tenantId,
        code: tt.code,
        name: tt.name,
        category: tt.category,
        flatFee: tt.flatFee,
        vatApplicable: tt.vatApplicable,
        requiresApprovalAbove: tt.requiresApprovalAbove,
      },
    });
  }
  console.log('Transaction type configs seed complete.');
}

async function main() {
  const tenantId = process.env.SEED_TENANT_ID;
  if (!tenantId) throw new Error('SEED_TENANT_ID env var required');
  await seedTransactionTypes(tenantId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
