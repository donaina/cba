import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GL_ACCOUNTS = [
  // ASSET
  { code: 'VAULT_CASH',            name: 'Vault Cash',                   type: 'ASSET',     normalBalance: 'DEBIT'  },
  { code: 'TELLER_CASH',           name: 'Teller Cash',                  type: 'ASSET',     normalBalance: 'DEBIT'  },
  { code: 'NIBSS_SETTLEMENT',      name: 'NIBSS Settlement',             type: 'ASSET',     normalBalance: 'DEBIT'  },
  { code: 'NIBSS_SUSPENSE',        name: 'NIBSS Suspense',               type: 'ASSET',     normalBalance: 'DEBIT'  },
  { code: 'LOAN_PORTFOLIO',        name: 'Loan Portfolio',               type: 'ASSET',     normalBalance: 'DEBIT'  },
  { code: 'LOAN_LOSS_PROVISION',   name: 'Loan Loss Provision (Contra)', type: 'ASSET',     normalBalance: 'CREDIT' },
  { code: 'PREPAYMENTS',           name: 'Prepayments',                  type: 'ASSET',     normalBalance: 'DEBIT'  },
  // LIABILITY
  { code: 'SAVINGS_CONTROL',       name: 'Savings Control',              type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: 'CURRENT_CONTROL',       name: 'Current Control',              type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: 'FIXED_DEPOSIT_CONTROL', name: 'Fixed Deposit Control',        type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: 'VAT_PAYABLE',           name: 'VAT Payable',                  type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: 'WHT_PAYABLE',           name: 'WHT Payable',                  type: 'LIABILITY', normalBalance: 'CREDIT' },
  // EQUITY
  { code: 'SHARE_CAPITAL',         name: 'Share Capital',                type: 'EQUITY',    normalBalance: 'CREDIT' },
  { code: 'RETAINED_EARNINGS',     name: 'Retained Earnings',            type: 'EQUITY',    normalBalance: 'CREDIT' },
  // INCOME
  { code: 'INTEREST_INCOME',       name: 'Interest Income',              type: 'INCOME',    normalBalance: 'CREDIT' },
  { code: 'FD_INTEREST_INCOME',    name: 'FD Interest Income',           type: 'INCOME',    normalBalance: 'CREDIT' },
  { code: 'FEE_INCOME',            name: 'Fee Income',                   type: 'INCOME',    normalBalance: 'CREDIT' },
  { code: 'NIP_FEE_INCOME',        name: 'NIP Fee Income',               type: 'INCOME',    normalBalance: 'CREDIT' },
  { code: 'PENALTY_INCOME',        name: 'Penalty Income',               type: 'INCOME',    normalBalance: 'CREDIT' },
  { code: 'ACCOUNT_MAINTENANCE',   name: 'Account Maintenance',          type: 'INCOME',    normalBalance: 'CREDIT' },
  // EXPENSE
  { code: 'BAD_DEBT_EXPENSE',      name: 'Bad Debt Expense',             type: 'EXPENSE',   normalBalance: 'DEBIT'  },
  { code: 'PROVISION_EXPENSE',     name: 'Provision Expense',            type: 'EXPENSE',   normalBalance: 'DEBIT'  },
  { code: 'SAVINGS_INTEREST_EXP',  name: 'Savings Interest Expense',     type: 'EXPENSE',   normalBalance: 'DEBIT'  },
  { code: 'FD_INTEREST_EXP',       name: 'FD Interest Expense',          type: 'EXPENSE',   normalBalance: 'DEBIT'  },
];

async function seedGl(tenantId: string) {
  console.log(`Seeding ${GL_ACCOUNTS.length} GL accounts for tenant ${tenantId}...`);
  for (const acct of GL_ACCOUNTS) {
    await prisma.gLAccount.upsert({
      where: { tenantId_code: { tenantId, code: acct.code } },
      update: { name: acct.name },
      create: {
        tenantId,
        code: acct.code,
        name: acct.name,
        type: acct.type as any,
        normalBalance: acct.normalBalance as any,
        level: 'DETAIL' as any,
        isSystemAccount: true,
      },
    });
  }
  console.log('GL seed complete.');
}

async function main() {
  const tenantId = process.env.SEED_TENANT_ID;
  if (!tenantId) throw new Error('SEED_TENANT_ID env var required');
  await seedGl(tenantId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
