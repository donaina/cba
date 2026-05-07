import { Decimal } from 'decimal.js';
import { EntryType, TransactionCategory } from '@prisma/client';

export interface JournalLine {
  glCode: string;
  entryType: EntryType;
  amount: Decimal;
  narration?: string;
  accountId?: string; // customer Account.id — set for entries touching individual accounts
}

export interface JournalEntry {
  reference: string;
  category: TransactionCategory;
  narration?: string;
  internalNarration?: string;
  channel?: string;
  initiatedBy?: string;
  idempotencyKey?: string;
  valueDate?: Date;
  entries: JournalLine[];
}
