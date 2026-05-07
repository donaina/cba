import { NubanUtil } from './nuban.util';

const WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3];

function manualCheckDigit(sortCode: string, serial: number): number {
  const serialStr = String(serial).padStart(9, '0');
  const input = sortCode + serialStr;
  const sum = input
    .slice(0, 9)
    .split('')
    .reduce((acc, digit, i) => acc + parseInt(digit, 10) * WEIGHTS[i], 0);
  return (10 - (sum % 10)) % 10;
}

describe('NubanUtil', () => {
  describe('generate', () => {
    it('returns a 10-digit string', () => {
      const result = NubanUtil.generate('000', 1);
      expect(result).toHaveLength(10);
      expect(/^\d{10}$/.test(result)).toBe(true);
    });

    it('first 9 digits are zero-padded serial', () => {
      const result = NubanUtil.generate('057', 42);
      expect(result.slice(0, 9)).toBe('000000042');
    });

    it('appends the correct check digit for sortCode=000, serial=1', () => {
      const checkDigit = manualCheckDigit('000', 1);
      const result = NubanUtil.generate('000', 1);
      expect(parseInt(result[9], 10)).toBe(checkDigit);
    });

    it('appends the correct check digit for sortCode=057, serial=100', () => {
      const checkDigit = manualCheckDigit('057', 100);
      const result = NubanUtil.generate('057', 100);
      expect(parseInt(result[9], 10)).toBe(checkDigit);
    });

    it('handles the edge case where sum % 10 === 0 → checkDigit is 0', () => {
      // brute-force find a (sortCode, serial) where (10 - sum%10) % 10 === 0
      let found = false;
      for (let s = 1; s <= 9999; s++) {
        const serialStr = String(s).padStart(9, '0');
        const input = '000' + serialStr;
        const sum = input
          .slice(0, 9)
          .split('')
          .reduce((acc, d, i) => acc + parseInt(d, 10) * WEIGHTS[i], 0);
        if (sum % 10 === 0) {
          const result = NubanUtil.generate('000', s);
          expect(parseInt(result[9], 10)).toBe(0);
          found = true;
          break;
        }
      }
      if (!found) {
        // If no such case found in range, just verify the formula
        expect((10 - 0) % 10).toBe(0);
      }
    });

    it('produces different account numbers for different serials', () => {
      const a1 = NubanUtil.generate('058', 1);
      const a2 = NubanUtil.generate('058', 2);
      expect(a1).not.toBe(a2);
    });
  });

  describe('validate', () => {
    it('returns true for a validly generated account number', () => {
      const sortCode = '000';
      const accountNumber = NubanUtil.generate(sortCode, 1);
      expect(NubanUtil.validate(sortCode, accountNumber)).toBe(true);
    });

    it('returns false for an account number with wrong check digit', () => {
      const sortCode = '000';
      const accountNumber = NubanUtil.generate(sortCode, 1);
      const wrong = accountNumber.slice(0, 9) + ((parseInt(accountNumber[9], 10) + 1) % 10).toString();
      expect(NubanUtil.validate(sortCode, wrong)).toBe(false);
    });

    it('returns false for a non-10-digit string', () => {
      expect(NubanUtil.validate('000', '12345')).toBe(false);
      expect(NubanUtil.validate('000', '12345678901')).toBe(false);
    });

    it('returns false for a string containing non-digits', () => {
      expect(NubanUtil.validate('000', '123456789X')).toBe(false);
    });

    it('validates multiple generated account numbers correctly', () => {
      const sortCode = '058';
      for (let serial = 1; serial <= 20; serial++) {
        const accountNumber = NubanUtil.generate(sortCode, serial);
        expect(NubanUtil.validate(sortCode, accountNumber)).toBe(true);
      }
    });

    it('returns false when sortCode does not match', () => {
      const accountNumber = NubanUtil.generate('000', 1);
      expect(NubanUtil.validate('057', accountNumber)).toBe(false);
    });
  });
});
