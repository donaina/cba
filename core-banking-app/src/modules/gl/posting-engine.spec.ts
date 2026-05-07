import { PostingEngine } from './posting-engine';
import { Decimal } from 'decimal.js';
import { EntryType, TransactionCategory } from '@prisma/client';

const mockGlAccount = {
  id: 'gl-account-uuid-1111-1111-1111',
  tenantId: 'tenant-uuid',
  code: 'VAULT_CASH',
  name: 'Vault Cash',
  type: 'ASSET',
  level: 'DETAIL',
  normalBalance: 'DEBIT',
  parentId: null,
  isSystemAccount: true,
  isActive: true,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGlAccount2 = {
  ...mockGlAccount,
  id: 'gl-account-uuid-2222-2222-2222',
  code: 'SAVINGS_CONTROL',
  name: 'Savings Control',
  type: 'LIABILITY',
  normalBalance: 'CREDIT',
};

const mockTransactionRecord = {
  id: 'tx-uuid-1111',
  tenantId: 'tenant-uuid',
  reference: 'DEP-001',
  category: TransactionCategory.OTC_DEPOSIT,
  status: 'COMPLETED',
  narration: 'Test deposit',
  internalNarration: null,
  channel: 'OTC',
  initiatedBy: 'user-uuid',
  approvedBy: null,
  reversedBy: null,
  reversalOf: null,
  idempotencyKey: null,
  valueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  entries: [],
};

function buildMockPrisma() {
  const txCallback = jest.fn();

  const prisma: any = {
    gLAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any, _opts: any) => {
      const tx = {
        transactionRecord: {
          create: jest.fn().mockResolvedValue(mockTransactionRecord),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...mockTransactionRecord, entries: [] }),
        },
        transactionEntry: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      };
      txCallback(tx);
      return fn(tx);
    }),
  };

  return { prisma, txCallback };
}

function buildMockGlService() {
  return {
    getSystemAccount: jest.fn(),
  } as any;
}

function buildMockCtx(tenantId = 'tenant-uuid') {
  return { tenantId, userId: 'user-uuid', branchId: 'branch-uuid', sessionId: 'session-uuid' } as any;
}

describe('PostingEngine', () => {
  let engine: PostingEngine;
  let prisma: any;
  let glService: any;

  beforeEach(() => {
    const mocks = buildMockPrisma();
    prisma = mocks.prisma;
    glService = buildMockGlService();

    prisma.gLAccount.findFirst
      .mockResolvedValueOnce(mockGlAccount)
      .mockResolvedValueOnce(mockGlAccount2);

    engine = new PostingEngine(glService, prisma, buildMockCtx());
  });

  describe('journal balance check', () => {
    it('throws "Journal does not balance" when debits do not equal credits', async () => {
      await expect(
        engine.post({
          reference: 'BAD-001',
          category: TransactionCategory.OTC_DEPOSIT,
          entries: [
            { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount: new Decimal('1000') },
            { glCode: 'SAVINGS_CONTROL', entryType: EntryType.CREDIT, amount: new Decimal('900') },
          ],
        }),
      ).rejects.toThrow('Journal does not balance');
    });

    it('throws when there are only debit entries', async () => {
      await expect(
        engine.post({
          reference: 'BAD-002',
          category: TransactionCategory.OTC_DEPOSIT,
          entries: [
            { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount: new Decimal('500') },
            { glCode: 'SAVINGS_CONTROL', entryType: EntryType.DEBIT, amount: new Decimal('500') },
          ],
        }),
      ).rejects.toThrow('Journal does not balance');
    });

    it('does not throw when debits equal credits', async () => {
      await expect(
        engine.post({
          reference: 'GOOD-001',
          category: TransactionCategory.OTC_DEPOSIT,
          entries: [
            { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount: new Decimal('1000') },
            { glCode: 'SAVINGS_CONTROL', entryType: EntryType.CREDIT, amount: new Decimal('1000') },
          ],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('transaction isolation', () => {
    it('calls prisma.$transaction with isolationLevel Serializable', async () => {
      await engine.post({
        reference: 'ISO-001',
        category: TransactionCategory.OTC_DEPOSIT,
        entries: [
          { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount: new Decimal('500') },
          { glCode: 'SAVINGS_CONTROL', entryType: EntryType.CREDIT, amount: new Decimal('500') },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
    });
  });

  describe('record and entry creation', () => {
    it('creates a TransactionRecord inside the transaction', async () => {
      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (fn: any, _opts: any) => {
        capturedTx = {
          transactionRecord: {
            create: jest.fn().mockResolvedValue(mockTransactionRecord),
            findUniqueOrThrow: jest.fn().mockResolvedValue({ ...mockTransactionRecord, entries: [] }),
          },
          transactionEntry: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return fn(capturedTx);
      });

      prisma.gLAccount.findFirst
        .mockResolvedValueOnce(mockGlAccount)
        .mockResolvedValueOnce(mockGlAccount2);

      await engine.post({
        reference: 'TX-001',
        category: TransactionCategory.OTC_DEPOSIT,
        narration: 'Test deposit',
        channel: 'OTC',
        initiatedBy: 'user-uuid',
        entries: [
          { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount: new Decimal('1000') },
          { glCode: 'SAVINGS_CONTROL', entryType: EntryType.CREDIT, amount: new Decimal('1000') },
        ],
      });

      expect(capturedTx.transactionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-uuid',
            reference: 'TX-001',
            category: TransactionCategory.OTC_DEPOSIT,
            narration: 'Test deposit',
            channel: 'OTC',
          }),
        }),
      );
    });

    it('creates TransactionEntry rows via createMany', async () => {
      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (fn: any, _opts: any) => {
        capturedTx = {
          transactionRecord: {
            create: jest.fn().mockResolvedValue(mockTransactionRecord),
            findUniqueOrThrow: jest.fn().mockResolvedValue({ ...mockTransactionRecord, entries: [] }),
          },
          transactionEntry: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return fn(capturedTx);
      });

      prisma.gLAccount.findFirst
        .mockResolvedValueOnce(mockGlAccount)
        .mockResolvedValueOnce(mockGlAccount2);

      await engine.post({
        reference: 'TX-002',
        category: TransactionCategory.OTC_DEPOSIT,
        entries: [
          { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount: new Decimal('750') },
          { glCode: 'SAVINGS_CONTROL', entryType: EntryType.CREDIT, amount: new Decimal('750') },
        ],
      });

      expect(capturedTx.transactionEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              tenantId: 'tenant-uuid',
              entryType: EntryType.DEBIT,
              glAccountId: mockGlAccount.id,
            }),
            expect.objectContaining({
              tenantId: 'tenant-uuid',
              entryType: EntryType.CREDIT,
              glAccountId: mockGlAccount2.id,
            }),
          ]),
        }),
      );
    });
  });
});
