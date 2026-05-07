import { Decimal } from 'decimal.js';
import { AmortizationUtil, AmortizationParams } from './amortization.util';

describe('AmortizationUtil', () => {
  const baseParams: Omit<AmortizationParams, 'method'> = {
    principal: new Decimal('120000'),
    annualRate: new Decimal('0.24'),
    tenorDays: 365,
    startDate: new Date('2024-01-01'),
    periodsPerYear: 12,
  };

  describe('BULLET', () => {
    it('returns exactly 1 row', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'BULLET' });
      expect(schedule).toHaveLength(1);
    });

    it('principal in the single row equals the loan principal', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'BULLET' });
      expect(schedule[0].principal.equals(baseParams.principal)).toBe(true);
    });

    it('closing balance is zero', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'BULLET' });
      expect(schedule[0].closingBalance.equals(0)).toBe(true);
    });

    it('interest = P × r × t/365', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'BULLET' });
      const expectedInterest = baseParams.principal
        .times(baseParams.annualRate)
        .times(baseParams.tenorDays)
        .dividedBy(365);
      expect(schedule[0].interest.toFixed(4)).toBe(expectedInterest.toFixed(4));
    });

    it('all values are Decimal instances', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'BULLET' });
      expect(schedule[0].principal).toBeInstanceOf(Decimal);
      expect(schedule[0].interest).toBeInstanceOf(Decimal);
      expect(schedule[0].total).toBeInstanceOf(Decimal);
      expect(schedule[0].openingBalance).toBeInstanceOf(Decimal);
      expect(schedule[0].closingBalance).toBeInstanceOf(Decimal);
    });

    it('due date is startDate + tenorDays', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'BULLET' });
      const expected = new Date('2024-01-01');
      expected.setDate(expected.getDate() + baseParams.tenorDays);
      expect(schedule[0].dueDate.getTime()).toBe(expected.getTime());
    });
  });

  describe('FLAT_RATE', () => {
    it('schedule length equals termMonths (tenorDays/365 * periodsPerYear)', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'FLAT_RATE' });
      const n = Math.round((baseParams.tenorDays / 365) * (baseParams.periodsPerYear ?? 12));
      expect(schedule).toHaveLength(n);
    });

    it('sum of principal payments equals original principal', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'FLAT_RATE' });
      const totalPrincipal = schedule.reduce((sum, row) => sum.plus(row.principal), new Decimal(0));
      expect(totalPrincipal.toDecimalPlaces(2).equals(baseParams.principal.toDecimalPlaces(2))).toBe(true);
    });

    it('last closing balance is zero', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'FLAT_RATE' });
      expect(schedule[schedule.length - 1].closingBalance.equals(0)).toBe(true);
    });

    it('installment numbers are sequential from 1', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'FLAT_RATE' });
      schedule.forEach((row, i) => {
        expect(row.no).toBe(i + 1);
      });
    });

    it('all values are Decimal instances', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'FLAT_RATE' });
      for (const row of schedule) {
        expect(row.principal).toBeInstanceOf(Decimal);
        expect(row.interest).toBeInstanceOf(Decimal);
        expect(row.total).toBeInstanceOf(Decimal);
        expect(row.openingBalance).toBeInstanceOf(Decimal);
        expect(row.closingBalance).toBeInstanceOf(Decimal);
      }
    });

    it('opening balance of first row equals principal', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'FLAT_RATE' });
      expect(schedule[0].openingBalance.toFixed(4)).toBe(baseParams.principal.toFixed(4));
    });
  });

  describe('REDUCING_BALANCE', () => {
    it('schedule length equals termMonths', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'REDUCING_BALANCE' });
      const n = Math.round((baseParams.tenorDays / 365) * (baseParams.periodsPerYear ?? 12));
      expect(schedule).toHaveLength(n);
    });

    it('sum of principal payments approximately equals original principal', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'REDUCING_BALANCE' });
      const totalPrincipal = schedule.reduce((sum, row) => sum.plus(row.principal), new Decimal(0));
      const diff = totalPrincipal.minus(baseParams.principal).abs();
      expect(diff.lessThan('1')).toBe(true);
    });

    it('last closing balance is zero', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'REDUCING_BALANCE' });
      expect(schedule[schedule.length - 1].closingBalance.equals(0)).toBe(true);
    });

    it('interest decreases as balance reduces (at least for first few rows)', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'REDUCING_BALANCE' });
      if (schedule.length > 2) {
        expect(schedule[0].interest.greaterThan(schedule[1].interest)).toBe(true);
      }
    });

    it('all values are Decimal instances', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'REDUCING_BALANCE' });
      for (const row of schedule) {
        expect(row.principal).toBeInstanceOf(Decimal);
        expect(row.interest).toBeInstanceOf(Decimal);
        expect(row.total).toBeInstanceOf(Decimal);
        expect(row.openingBalance).toBeInstanceOf(Decimal);
        expect(row.closingBalance).toBeInstanceOf(Decimal);
      }
    });

    it('installment numbers are sequential from 1', () => {
      const schedule = AmortizationUtil.buildSchedule({ ...baseParams, method: 'REDUCING_BALANCE' });
      schedule.forEach((row, i) => {
        expect(row.no).toBe(i + 1);
      });
    });
  });
});
