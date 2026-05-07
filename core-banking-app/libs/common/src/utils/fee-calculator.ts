import { Decimal } from 'decimal.js';
import { toDecimal } from './decimal.util';

export interface TransactionFeeConfig {
  flatFee: Decimal | string;
  percentageFee: Decimal | string;
  minFee: Decimal | string;
  maxFee: Decimal | string;
  vatApplicable: boolean;
  whtApplicable: boolean;
}

export interface FeeResult {
  baseFee: Decimal;
  vat: Decimal;
  wht: Decimal;
  totalFee: Decimal;
}

// CBN NIP fee tiers (VAT-inclusive)
const NIP_TIERS: Array<{ upTo: Decimal; fee: Decimal }> = [
  { upTo: toDecimal('5000'), fee: toDecimal('10.75') },
  { upTo: toDecimal('50000'), fee: toDecimal('26.88') },
  { upTo: toDecimal('99999999999'), fee: toDecimal('53.75') },
];

export class FeeCalculator {
  static calculate(
    amount: Decimal,
    config: TransactionFeeConfig,
    vatRate: Decimal = toDecimal('0.075'),
    whtRate: Decimal = toDecimal('0'),
  ): FeeResult {
    const flat = toDecimal(config.flatFee);
    const pct = toDecimal(config.percentageFee);
    const min = toDecimal(config.minFee);
    const max = toDecimal(config.maxFee);

    let baseFee = flat.plus(amount.times(pct));
    if (baseFee.lessThan(min)) baseFee = min;
    if (baseFee.greaterThan(max)) baseFee = max;

    const vat = config.vatApplicable ? baseFee.times(vatRate).toDecimalPlaces(4) : new Decimal(0);
    const wht = config.whtApplicable ? baseFee.times(whtRate).toDecimalPlaces(4) : new Decimal(0);

    return {
      baseFee: baseFee.toDecimalPlaces(4),
      vat,
      wht,
      totalFee: baseFee.plus(vat).minus(wht).toDecimalPlaces(4),
    };
  }

  static nipFee(amount: Decimal): Decimal {
    for (const tier of NIP_TIERS) {
      if (amount.lessThanOrEqualTo(tier.upTo)) return tier.fee;
    }
    return toDecimal('53.75');
  }
}
