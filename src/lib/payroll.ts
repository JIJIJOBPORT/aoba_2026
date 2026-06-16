import { getSheetRows, SHEETS, parseNumber } from './sheets';
import { PayrollRecord } from '@/types';

function rowToRecord(row: string[]): PayrollRecord {
  return {
    id: row[0] ?? '',
    employeeId: row[1] ?? '',
    paymentMonth: row[2] ?? '',
    paymentDate: row[3] ?? '',
    recordType: (row[4] as PayrollRecord['recordType']) ?? '給与',
    workDays: parseNumber(row[5]),
    paidLeaveDays: parseNumber(row[6]),
    absentDays: parseNumber(row[7]),
    workHours: parseNumber(row[8]),
    overtimeHours: parseNumber(row[9]),
    basicSalary: parseNumber(row[10]),
    positionAllowance: parseNumber(row[11]),
    familyAllowance: parseNumber(row[12]),
    housingAllowance: parseNumber(row[13]),
    allowances: parseNumber(row[14]),
    overtimePay: parseNumber(row[15]),
    transportAllowance: parseNumber(row[16]),
    grossPay: parseNumber(row[17]),
    healthInsurance: parseNumber(row[18]),
    pensionInsurance: parseNumber(row[19]),
    employmentInsurance: parseNumber(row[20]),
    longCareInsurance: parseNumber(row[21]),
    childcareSupport: parseNumber(row[22]),
    incomeTax: parseNumber(row[23]),
    residentTax: parseNumber(row[24]),
    totalDeductions: parseNumber(row[25]),
    netPay: parseNumber(row[26]),
    note: row[27] ?? '',
    pdfUrl: row[28] ?? '',
  };
}

export async function getPayrollByEmployee(employeeId: string): Promise<PayrollRecord[]> {
  const rows = await getSheetRows(SHEETS.PAYROLL);
  return rows
    .filter((row) => row[1] === employeeId)
    .map(rowToRecord)
    .sort((a, b) => b.paymentMonth.localeCompare(a.paymentMonth));
}

export async function getAllPayroll(): Promise<PayrollRecord[]> {
  const rows = await getSheetRows(SHEETS.PAYROLL);
  return rows.filter((row) => row[0]).map(rowToRecord);
}
