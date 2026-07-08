import { getSheetRows, getSheetData, SHEETS, parseNumber } from './sheets';
import { getSheetsClient } from './google-auth';
import { normalizeMonth } from './utils';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

export interface ShiftMaster {
  weekday: string;
  scheduledHours: number;
}

export interface Holiday {
  date: string;
  type: string;
  note: string;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string;
  weekday: string;
  scheduledHours: number;
  category: '通常' | '有給' | '半休午前' | '半休午後' | '欠勤' | '休日出勤' | '定休' | '特別休暇';
  actualHours: number;
  note: string;
}

export interface MonthlySummary {
  scheduledDays: number;
  scheduledHours: number;
  workedDays: number;
  workedHours: number;
  paidLeaveDays: number;
  absentDays: number;
  holidayWorkDays: number;
}

// 勤務シフトマスタ取得
export async function getShiftMaster(): Promise<ShiftMaster[]> {
  const rows = await getSheetRows('勤務シフトマスタ');
  return rows.filter((r) => r[0]).map((r) => ({
    weekday: r[0] ?? '',
    scheduledHours: parseNumber(r[1]),
  }));
}

// 休日マスタ取得
export async function getHolidays(): Promise<Holiday[]> {
  const rows = await getSheetRows('休日マスタ');
  return rows.filter((r) => r[0]).map((r) => ({
    date: r[0] ?? '',
    type: r[1] ?? '',
    note: r[2] ?? '',
  }));
}

// 勤怠記録取得（社員×年月）
export async function getAttendanceRecords(
  employeeId: string,
  yearMonth: string
): Promise<AttendanceRecord[]> {
  const rows = await getSheetRows('勤怠記録');
  return rows
    // 日付は "2026/5/1" と "2026/05/01" が混在しうるため、YYYY-MM に正規化して比較する
    .filter((r) => r[0] === employeeId && normalizeMonth(r[1]) === normalizeMonth(yearMonth))
    .map((r) => ({
      employeeId: r[0] ?? '',
      date: r[1] ?? '',
      weekday: r[2] ?? '',
      scheduledHours: parseNumber(r[3]),
      category: (r[4] as AttendanceRecord['category']) ?? '通常',
      actualHours: parseNumber(r[5]),
      note: r[6] ?? '',
    }));
}

// 月次カレンダーを自動生成してシートに書き込む
export async function generateMonthlyAttendance(
  employeeId: string,
  yearMonth: string
): Promise<AttendanceRecord[]> {
  const [shifts, holidays] = await Promise.all([getShiftMaster(), getHolidays()]);

  const shiftMap = Object.fromEntries(shifts.map((s) => [s.weekday, s.scheduledHours]));
  const holidaySet = new Set(holidays.map((h) => normalizeDate(h.date)));
  const holidayTypeMap = Object.fromEntries(
    holidays.map((h) => [normalizeDate(h.date), h.type])
  );

  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const records: AttendanceRecord[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    const weekday = WEEKDAY_JP[date.getDay()];
    const normalizedDate = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const scheduledHours = shiftMap[weekday] ?? 0;
    const isHoliday = holidaySet.has(normalizedDate) || holidaySet.has(dateStr);
    const isClosed = weekday === '日' || scheduledHours === 0;

    let category: AttendanceRecord['category'];
    let actualHours = scheduledHours;

    if (isHoliday) {
      category = '特別休暇';
      actualHours = 0;
    } else if (isClosed) {
      category = '定休';
      actualHours = 0;
    } else {
      category = '通常';
    }

    records.push({
      employeeId,
      date: dateStr,
      weekday,
      scheduledHours,
      category,
      actualHours,
      note: isHoliday ? holidayTypeMap[normalizedDate] ?? holidayTypeMap[dateStr] ?? '' : '',
    });
  }

  // シートに書き込む（既存データは削除して再生成）
  const sheets = getSheetsClient();
  const allData = await getSheetData('勤怠記録');
  const header = allData[0] ?? ['社員ID', '日付', '曜日', '所定時間', '区分', '実労働時間', '備考'];
  const otherRows = allData.slice(1).filter(
    (r) => !(r[0] === employeeId && normalizeDate(r[1]).startsWith(yearMonth))
  );

  const newRows = [
    header,
    ...otherRows,
    ...records.map((r) => [
      r.employeeId, r.date, r.weekday, r.scheduledHours, r.category, r.actualHours, r.note,
    ]),
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: '勤怠記録',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '勤怠記録!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: newRows },
  });

  return records;
}

// 勤怠区分を更新
export async function updateAttendanceCategory(
  employeeId: string,
  date: string,
  category: AttendanceRecord['category'],
  note: string
): Promise<void> {
  const sheets = getSheetsClient();
  const allData = await getSheetData('勤怠記録');
  const normalizedTarget = normalizeDate(date);

  const rowIndex = allData.findIndex(
    (r, i) => i > 0 && r[0] === employeeId && normalizeDate(r[1]) === normalizedTarget
  );
  if (rowIndex === -1) throw new Error(`対象日のデータが見つかりません: ${date}`);

  const row = [...allData[rowIndex]];
  const scheduledHours = parseNumber(row[3]);

  // 実労働時間の計算
  let actualHours = scheduledHours;
  if (category === '有給') actualHours = 0;
  else if (category === '半休午前' || category === '半休午後') actualHours = scheduledHours / 2;
  else if (category === '欠勤' || category === '定休' || category === '特別休暇') actualHours = 0;

  row[4] = category;
  row[5] = String(actualHours);
  row[6] = note;

  const colEnd = String.fromCharCode(65 + row.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `勤怠記録!A${rowIndex + 1}:${colEnd}${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// 月次集計
export function summarizeAttendance(records: AttendanceRecord[]): MonthlySummary {
  const workDays = records.filter((r) => r.category !== '定休' && r.category !== '特別休暇' && r.scheduledHours > 0);
  return {
    scheduledDays: workDays.length,
    scheduledHours: workDays.reduce((s, r) => s + r.scheduledHours, 0),
    workedDays: records.filter((r) => r.category === '通常' || r.category === '休日出勤').length,
    workedHours: records.filter((r) => r.category === '通常' || r.category === '休日出勤').reduce((s, r) => s + r.actualHours, 0),
    paidLeaveDays: records.filter((r) => r.category === '有給').length +
      records.filter((r) => r.category === '半休午前' || r.category === '半休午後').length * 0.5,
    absentDays: records.filter((r) => r.category === '欠勤').length,
    holidayWorkDays: records.filter((r) => r.category === '休日出勤').length,
  };
}

function normalizeDate(dateStr: string): string {
  return dateStr.replace(/\//g, '-');
}

// 有給取得記録を勤怠カレンダーに反映する（有給→勤怠）。
// generateMissing=true の場合、勤怠カレンダー未生成の月は自動生成する。
export async function reflectPaidLeaveToAttendance(
  employeeId: string,
  opts: { generateMissing?: boolean } = {}
): Promise<{ synced: number; generated: number; errors: string[] }> {
  const { generateMissing = true } = opts;
  const { getPaidLeaveUsageByEmployee } = await import('./paid-leave');

  const usages = await getPaidLeaveUsageByEmployee(employeeId);
  let synced = 0;
  let generated = 0;
  const errors: string[] = [];
  if (usages.length === 0) return { synced, generated, errors };

  const yearMonths = [...new Set(usages.map((u) => normalizeMonth(u.usedDate)))];

  for (const yearMonth of yearMonths) {
    const existing = await getAttendanceRecords(employeeId, yearMonth);
    if (existing.length === 0) {
      if (!generateMissing) continue; // 未生成の月はスキップ
      await generateMonthlyAttendance(employeeId, yearMonth);
      generated++;
    }

    const monthUsages = usages.filter((u) => normalizeMonth(u.usedDate) === yearMonth);
    for (const usage of monthUsages) {
      try {
        const category =
          usage.usageType === '半日午前' ? '半休午前' as const :
          usage.usageType === '半日午後' ? '半休午後' as const : '有給' as const;
        await updateAttendanceCategory(
          employeeId,
          usage.usedDate,
          category,
          `有給取得（${usage.usageType}）${usage.note ? ' ' + usage.note : ''}`
        );
        synced++;
      } catch (e) {
        errors.push(`${usage.usedDate}: ${String(e)}`);
      }
    }
  }

  return { synced, generated, errors };
}
