const WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3];

export class NubanUtil {
  static generate(bankSortCode: string, serial: number): string {
    const serialStr = String(serial).padStart(9, '0');
    const input = bankSortCode + serialStr;
    const sum = input
      .slice(0, 9)
      .split('')
      .reduce((acc, digit, i) => acc + parseInt(digit, 10) * WEIGHTS[i], 0);
    const checkDigit = (10 - (sum % 10)) % 10;
    return serialStr + String(checkDigit);
  }

  static validate(bankSortCode: string, accountNumber: string): boolean {
    if (!/^\d{10}$/.test(accountNumber)) return false;
    const serial = accountNumber.slice(0, 9);
    const checkDigit = parseInt(accountNumber[9], 10);
    const input = bankSortCode + serial;
    const sum = input
      .slice(0, 9)
      .split('')
      .reduce((acc, digit, i) => acc + parseInt(digit, 10) * WEIGHTS[i], 0);
    return (10 - (sum % 10)) % 10 === checkDigit;
  }
}
