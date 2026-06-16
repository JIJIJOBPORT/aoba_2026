import { getSheetRows, SHEETS, parseNumber } from './sheets';
import { SocialInsuranceRate, EmploymentInsuranceRate } from '@/types';

// 適用開始日が給与月以前で最新のレコードを返す
function findApplicableRate<T extends { effectiveDate: string }>(
  rates: T[],
  paymentMonth: string
): T | null {
  const targetYM = paymentMonth.replace('-', '');
  const applicable = rates
    .filter((r) => r.effectiveDate.replace(/-/g, '').slice(0, 6) <= targetYM)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return applicable[0] ?? null;
}

export async function getSocialInsuranceRates(): Promise<SocialInsuranceRate[]> {
  const rows = await getSheetRows(SHEETS.SOCIAL_INSURANCE);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      effectiveDate: r[0] ?? '',
      healthInsuranceRate: parseNumber(r[1]),
      pensionInsuranceRate: parseNumber(r[2]),
      longCareInsuranceRate: parseNumber(r[3]),
      childcareSupportRate: parseNumber(r[4]),
      prefecture: r[5] ?? '',
    }));
}

export async function getEmploymentInsuranceRates(): Promise<EmploymentInsuranceRate[]> {
  const rows = await getSheetRows(SHEETS.EMPLOYMENT_INSURANCE);
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      effectiveDate: r[0] ?? '',
      generalRate: parseNumber(r[1]),
      constructionRate: parseNumber(r[2]),
    }));
}

// 標準報酬月額の等級表（簡易版・協会けんぽ）
const STANDARD_MONTHLY_SALARY_TABLE = [
  58000, 68000, 78000, 88000, 98000, 104000, 110000, 118000, 126000,
  134000, 142000, 150000, 160000, 170000, 180000, 190000, 200000, 220000,
  240000, 260000, 280000, 300000, 320000, 340000, 360000, 380000, 400000,
  425000, 450000, 475000, 500000, 530000, 560000, 590000, 620000, 650000,
];

export function getStandardMonthlySalary(grossPay: number): number {
  for (const std of STANDARD_MONTHLY_SALARY_TABLE) {
    if (grossPay <= std) return std;
  }
  return STANDARD_MONTHLY_SALARY_TABLE[STANDARD_MONTHLY_SALARY_TABLE.length - 1];
}

// 源泉所得税をスプレッドシートのマスタから取得
export async function getIncomeTax(
  taxableAmount: number,
  dependents: number,
  paymentMonth: string
): Promise<number> {
  const rows = await getSheetRows(SHEETS.WITHHOLDING_TAX);
  const year = paymentMonth.slice(0, 4);

  // 適用年度のデータを絞り込み（なければ最新年度）
  const yearRows = rows.filter((r) => r[0] === year);
  const targetRows = yearRows.length > 0 ? yearRows : rows;

  // 課税額が範囲内の行を検索（B列: 以上, C列: 未満）
  const match = targetRows.find((r) => {
    const lower = parseNumber(r[1]);
    const upper = r[2] ? parseNumber(r[2]) : Infinity;
    return taxableAmount >= lower && taxableAmount < upper;
  });

  if (!match) return 0;

  // 扶養人数に対応する列（D列=0人, E列=1人...）
  const colIndex = Math.min(dependents, 7) + 3;
  return parseNumber(match[colIndex]);
}

export interface DeductionResult {
  healthInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  longCareInsurance: number;
  childcareSupport: number;
  incomeTax: number;
  totalDeductions: number;
}

export async function calculateDeductions(params: {
  grossPay: number;
  paymentMonth: string;
  dependents: number;
  birthDate: string;
  residentTax: number;
}): Promise<DeductionResult> {
  const { grossPay, paymentMonth, dependents, birthDate, residentTax } = params;

  const [socialRates, employmentRates] = await Promise.all([
    getSocialInsuranceRates(),
    getEmploymentInsuranceRates(),
  ]);

  const socialRate = findApplicableRate(socialRates, paymentMonth);
  const employmentRate = findApplicableRate(employmentRates, paymentMonth);

  const standardSalary = getStandardMonthlySalary(grossPay);

  // 年齢計算（介護保険: 40歳以上65歳未満）
  const birthYear = parseInt(birthDate.slice(0, 4));
  const payYear = parseInt(paymentMonth.slice(0, 4));
  const age = payYear - birthYear;
  const requiresLongCare = age >= 40 && age < 65;

  const healthInsurance = socialRate
    ? Math.floor(standardSalary * socialRate.healthInsuranceRate)
    : 0;
  const pensionInsurance = socialRate
    ? Math.floor(standardSalary * socialRate.pensionInsuranceRate)
    : 0;
  const longCareInsurance =
    socialRate && requiresLongCare
      ? Math.floor(standardSalary * socialRate.longCareInsuranceRate)
      : 0;
  const childcareSupport = socialRate
    ? Math.floor(standardSalary * socialRate.childcareSupportRate)
    : 0;
  const employmentInsurance = employmentRate
    ? Math.floor(grossPay * employmentRate.generalRate)
    : 0;

  // 課税対象額（総支給 - 社会保険料合計）
  const socialTotal = healthInsurance + pensionInsurance + longCareInsurance + childcareSupport + employmentInsurance;
  const taxableAmount = Math.max(0, grossPay - socialTotal);

  const incomeTax = await getIncomeTax(taxableAmount, dependents, paymentMonth);

  const totalDeductions = socialTotal + incomeTax + residentTax;

  return {
    healthInsurance,
    pensionInsurance,
    employmentInsurance,
    longCareInsurance,
    childcareSupport,
    incomeTax,
    totalDeductions,
  };
}
