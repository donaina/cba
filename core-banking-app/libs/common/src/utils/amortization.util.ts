import { Decimal } from 'decimal.js';
import { toDecimal } from './decimal.util';

export interface InstallmentRow {
  no: number;
  dueDate: Date;
  principal: Decimal;
  interest: Decimal;
  total: Decimal;
  openingBalance: Decimal;
  closingBalance: Decimal;
}

export interface AmortizationParams {
  principal: Decimal;
  annualRate: Decimal;
  tenorDays: number;
  startDate: Date;
  method: 'FLAT_RATE' | 'REDUCING_BALANCE' | 'BULLET';
  periodsPerYear?: number;
}

export class AmortizationUtil {
  static buildSchedule(params: AmortizationParams): InstallmentRow[] {
    const { principal, annualRate, tenorDays, startDate, method } = params;
    const periodsPerYear = params.periodsPerYear ?? 12;

    if (method === 'BULLET') {
      const interest = principal
        .times(annualRate)
        .times(tenorDays)
        .dividedBy(365);
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + tenorDays);
      return [
        {
          no: 1,
          dueDate,
          principal,
          interest: interest.toDecimalPlaces(4),
          total: principal.plus(interest).toDecimalPlaces(4),
          openingBalance: principal,
          closingBalance: new Decimal(0),
        },
      ];
    }

    const n = Math.round((tenorDays / 365) * periodsPerYear);
    const r = annualRate.dividedBy(periodsPerYear);
    const rows: InstallmentRow[] = [];

    if (method === 'FLAT_RATE') {
      const totalInterest = principal.times(annualRate).times(tenorDays).dividedBy(365);
      const principalPerPeriod = principal.dividedBy(n).toDecimalPlaces(4);
      const interestPerPeriod = totalInterest.dividedBy(n).toDecimalPlaces(4);
      let balance = principal;
      for (let i = 1; i <= n; i++) {
        const opening = balance;
        const isLast = i === n;
        const p = isLast ? balance : principalPerPeriod;
        const closing = isLast ? new Decimal(0) : balance.minus(p);
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + Math.round((tenorDays / n) * i));
        rows.push({
          no: i,
          dueDate,
          principal: p.toDecimalPlaces(4),
          interest: interestPerPeriod,
          total: p.plus(interestPerPeriod).toDecimalPlaces(4),
          openingBalance: opening.toDecimalPlaces(4),
          closingBalance: closing.toDecimalPlaces(4),
        });
        balance = closing;
      }
    } else {
      // Reducing balance EMI: P × r × (1+r)^n / ((1+r)^n - 1)
      const onePlusR = r.plus(1);
      const onePlusRpowN = onePlusR.pow(n);
      const emi = principal
        .times(r)
        .times(onePlusRpowN)
        .dividedBy(onePlusRpowN.minus(1))
        .toDecimalPlaces(4);
      let balance = principal;
      for (let i = 1; i <= n; i++) {
        const opening = balance;
        const interestDue = balance.times(r).toDecimalPlaces(4);
        const isLast = i === n;
        const principalDue = isLast ? balance : emi.minus(interestDue).toDecimalPlaces(4);
        const closing = isLast ? new Decimal(0) : balance.minus(principalDue).toDecimalPlaces(4);
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + Math.round((tenorDays / n) * i));
        rows.push({
          no: i,
          dueDate,
          principal: principalDue,
          interest: interestDue,
          total: principalDue.plus(interestDue).toDecimalPlaces(4),
          openingBalance: opening.toDecimalPlaces(4),
          closingBalance: closing,
        });
        balance = closing;
      }
    }
    return rows;
  }
}
