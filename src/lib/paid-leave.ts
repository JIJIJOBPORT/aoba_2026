import { getSheetRows, appendRow, SHEETS } from './sheets';
import { PaidLeaveRecord, PaidLeaveUsage } from '@/types';
import { parseNumber } from './sheets';

// 有給管理シートの定数（列インデックス）
const COL = {
  EMPLOYEE_ID: 0,   // A: 社員ID
  FISCAL_YEAR: 1,   // B: 管理年度
  GRANT_DATE: 2,    // C: 付与日
  GRANT_DAYS: 3,    // D: 付与日数
  CARRYOVER: 4,     // E: 繰越日数
  USED_DAYS: 5,     // F: 使用日数
  REMAINING: 6,     // G: 残日数
  EXPIRY: 7,        // H: 有効期限
};

export async function getPaidLeaveByEmployee(employeeId: string): Promise<PaidLeaveRecord[]> {
  const rows = await getSheetRows(SHEETS.PAID_LEAVE);
  return rows
    .filter((r) => r[COL.EMPLOYEE_ID] === employeeId)
    .map((r) => ({
      employeeId: r[COL.EMPLOYEE_ID] ?? '',
      fiscalYear: r[COL.FISCAL_YEAR] ?? '',
      grantDate: r[COL.GRANT_DATE] ?? '',
      grantDays: parseNumber(r[COL.GRANT_DAYS]),
      carryoverDays: parseNumber(r[COL.CARRYOVER]),
      usedDays: parseNumber(r[COL.USED_DAYS]),
      remainingDays: parseNumber(r[COL.REMAINING]),
      expiryDate: r[COL.EXPIRY] ?? '',
    }))
    .sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear));
}

export async function getPaidLeaveUsageByEmployee(
  employeeId: string,
  year?: string
): Promise<PaidLeaveUsage[]> {
  const rows = await getSheetRows('有給取得記録');
  return rows
    .filter((r) => {
      if (r[0] !== employeeId) return false;
      if (year && !r[1].startsWith(year)) return false;
      return true;
    })
    .map((r) => ({
      employeeId: r[0] ?? '',
      usedDate: r[1] ?? '',
      usedDays: parseNumber(r[2]),
      usageType: (r[3] as PaidLeaveUsage['usageType']) ?? '全日',
      note: r[4] ?? '',
    }))
    .sort((a, b) => a.usedDate.localeCompare(b.usedDate));
}

// 有給取得記録を追加してシートを更新
export async function addPaidLeaveUsage(usage: Omit<PaidLeaveUsage, 'note'> & { note?: string }): Promise<void> {
  await appendRow('有給取得記録', [
    usage.employeeId,
    usage.usedDate,
    usage.usedDays,
    usage.usageType,
    usage.note ?? '',
  ]);
}

// 残日数の計算（付与+繰越-使用）
export function calcRemainingDays(record: PaidLeaveRecord): number {
  return record.grantDays + record.carryoverDays - record.usedDays;
}

// 月次の有給取得日数を集計（勤怠計算用）
export async function getMonthlyUsedDays(
  employeeId: string,
  yearMonth: string // YYYY-MM
): Promise<number> {
  const usages = await getPaidLeaveUsageByEmployee(employeeId, yearMonth.slice(0, 4));
  return usages
    .filter((u) => u.usedDate.replace(/\//g, '-').startsWith(yearMonth))
    .reduce((sum, u) => sum + u.usedDays, 0);
}
