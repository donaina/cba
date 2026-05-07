import { Decimal } from 'decimal.js';
import { FeeCalculator, TransactionFeeConfig } from './fee-calculator';

describe('FeeCalculator', () => {
  describe('nipFee', () => {
    it('returns ₦10.75 for amounts ≤ ₦5,000', () => {
      expect(FeeCalculator.nipFee(new Decimal('1')).toFixed(2)).toBe('10.75');
      expect(FeeCalculator.nipFee(new Decimal('100')).toFixed(2)).toBe('10.75');
      expect(FeeCalculator.nipFee(new Decimal('5000')).toFixed(2)).toBe('10.75');
    });

    it('returns ₦26.88 for amounts > ₦5,000 and ≤ ₦50,000', () => {
      expect(FeeCalculator.nipFee(new Decimal('5001')).toFixed(2)).toBe('26.88');
      expect(FeeCalculator.nipFee(new Decimal('25000')).toFixed(2)).toBe('26.88');
      expect(FeeCalculator.nipFee(new Decimal('50000')).toFixed(2)).toBe('26.88');
    });

    it('returns ₦53.75 for amounts > ₦50,000', () => {
      expect(FeeCalculator.nipFee(new Decimal('50001')).toFixed(2)).toBe('53.75');
      expect(FeeCalculator.nipFee(new Decimal('100000')).toFixed(2)).toBe('53.75');
      expect(FeeCalculator.nipFee(new Decimal('5000000')).toFixed(2)).toBe('53.75');
    });

    it('returns Decimal instances', () => {
      const result = FeeCalculator.nipFee(new Decimal('1000'));
      expect(result).toBeInstanceOf(Decimal);
    });
  });

  describe('calculate', () => {
    const baseConfig: TransactionFeeConfig = {
      flatFee: '100',
      percentageFee: '0',
      minFee: '0',
      maxFee: '999999',
      vatApplicable: false,
      whtApplicable: false,
    };

    it('returns flat fee when percentage is zero', () => {
      const result = FeeCalculator.calculate(new Decimal('5000'), baseConfig);
      expect(result.baseFee.toFixed(4)).toBe('100.0000');
    });

    it('adds percentage fee to flat fee', () => {
      const config: TransactionFeeConfig = { ...baseConfig, percentageFee: '0.01' };
      const result = FeeCalculator.calculate(new Decimal('1000'), config);
      expect(result.baseFee.toFixed(4)).toBe('110.0000');
    });

    it('applies minFee floor when computed fee is below minimum', () => {
      const config: TransactionFeeConfig = { ...baseConfig, flatFee: '0', minFee: '50' };
      const result = FeeCalculator.calculate(new Decimal('1'), config);
      expect(result.baseFee.toFixed(4)).toBe('50.0000');
    });

    it('applies maxFee ceiling when computed fee exceeds maximum', () => {
      const config: TransactionFeeConfig = { ...baseConfig, flatFee: '0', percentageFee: '0.1', maxFee: '200' };
      const result = FeeCalculator.calculate(new Decimal('5000'), config);
      expect(result.baseFee.toFixed(4)).toBe('200.0000');
    });

    it('computes VAT at 7.5% when vatApplicable is true', () => {
      const config: TransactionFeeConfig = { ...baseConfig, vatApplicable: true };
      const result = FeeCalculator.calculate(new Decimal('5000'), config);
      const expectedVat = new Decimal('100').times('0.075');
      expect(result.vat.toFixed(4)).toBe(expectedVat.toDecimalPlaces(4).toFixed(4));
      expect(result.totalFee.toFixed(4)).toBe(new Decimal('100').plus(expectedVat).toDecimalPlaces(4).toFixed(4));
    });

    it('VAT is zero when vatApplicable is false', () => {
      const result = FeeCalculator.calculate(new Decimal('5000'), baseConfig);
      expect(result.vat.toFixed(4)).toBe('0.0000');
    });

    it('returns Decimal instances for all result fields', () => {
      const result = FeeCalculator.calculate(new Decimal('1000'), baseConfig);
      expect(result.baseFee).toBeInstanceOf(Decimal);
      expect(result.vat).toBeInstanceOf(Decimal);
      expect(result.wht).toBeInstanceOf(Decimal);
      expect(result.totalFee).toBeInstanceOf(Decimal);
    });
  });
});
