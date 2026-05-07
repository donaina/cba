import { Decimal } from 'decimal.js';

export function toDecimal(val: string | number | Decimal): Decimal {
  return new Decimal(val instanceof Decimal ? val : val.toString());
}

export function decimalSum(vals: (string | number | Decimal)[]): Decimal {
  return vals.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}
