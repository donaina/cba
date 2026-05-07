import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { TransactionRecord, TransactionStatus } from '@prisma/client';
import { GlService } from './gl.service';
import { JournalEntry } from './interfaces/journal-entry.interface';

/** Simple UUID v4 pattern */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

@Injectable()
export class PostingEngine {
  constructor(
    private readonly glService: GlService,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async post(journal: JournalEntry): Promise<TransactionRecord> {
    const tenantId = this.ctx.tenantId;

    // ── Step 1: Verify the journal balances ──────────────────────────────────
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of journal.entries) {
      if (line.entryType === 'DEBIT') {
        totalDebits = totalDebits.plus(line.amount);
      } else {
        totalCredits = totalCredits.plus(line.amount);
      }
    }

    if (!totalDebits.equals(totalCredits)) {
      throw new Error('Journal does not balance');
    }

    // ── Step 2: Resolve each GL code to an account ID ────────────────────────
    const resolvedGlAccounts: Array<{ id: string; level: string }> = await Promise.all(
      journal.entries.map(async (line) => {
        // If it looks like a UUID, try direct ID lookup first
        if (isUuid(line.glCode)) {
          const byId = await this.prisma.gLAccount.findFirst({
            where: { id: line.glCode, tenantId },
            select: { id: true, level: true },
          });
          if (byId) return byId;
        }

        // Otherwise (or if UUID lookup missed), look up by code
        const byCode = await this.prisma.gLAccount.findFirst({
          where: { code: line.glCode, tenantId },
          select: { id: true, level: true },
        });
        if (byCode) return byCode;

        // Last resort — let GlService.getSystemAccount throw a descriptive error
        const sys = await this.glService.getSystemAccount(line.glCode, tenantId);
        return { id: sys.id, level: sys.level };
      }),
    );

    // ── Step 2b: All target accounts must be DETAIL level ────────────────────
    for (let i = 0; i < journal.entries.length; i++) {
      if (resolvedGlAccounts[i].level !== 'DETAIL') {
        throw new Error(
          `GL account '${journal.entries[i].glCode}' is not a DETAIL-level account and cannot accept postings`,
        );
      }
    }

    // ── Step 3: Serializable transaction — write TransactionRecord + entries ─
    return this.prisma.$transaction(
      async (tx) => {
        const record = await tx.transactionRecord.create({
          data: {
            tenantId,
            reference: journal.reference,
            category: journal.category,
            status: TransactionStatus.COMPLETED,
            narration: journal.narration ?? null,
            internalNarration: journal.internalNarration ?? null,
            channel: journal.channel ?? null,
            initiatedBy: journal.initiatedBy ?? null,
            idempotencyKey: journal.idempotencyKey ?? null,
            valueDate: journal.valueDate ?? null,
          },
        });

        await tx.transactionEntry.createMany({
          data: journal.entries.map((line, idx) => ({
            tenantId,
            transactionId: record.id,
            glAccountId: resolvedGlAccounts[idx].id,
            accountId: line.accountId ?? null,
            entryType: line.entryType,
            amount: line.amount,
            narration: line.narration ?? null,
          })),
        });

        // Return with entries included
        return tx.transactionRecord.findUniqueOrThrow({
          where: { id: record.id },
          include: { entries: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
