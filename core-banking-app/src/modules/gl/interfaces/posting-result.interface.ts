import { Decimal } from 'decimal.js';
import {
  EntryType,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';

export interface PostingEntryResult {
  id: string;
  tenantId: string;
  transactionId: string;
  glAccountId: string;
  entryType: EntryType;
  amount: Decimal;
  narration: string | null;
  createdAt: Date;
}

export interface PostingResult {
  id: string;
  tenantId: string;
  reference: string;
  category: TransactionCategory;
  status: TransactionStatus;
  narration: string | null;
  internalNarration: string | null;
  channel: string | null;
  initiatedBy: string | null;
  approvedBy: string | null;
  reversedBy: string | null;
  reversalOf: string | null;
  idempotencyKey: string | null;
  valueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  entries: PostingEntryResult[];
}
