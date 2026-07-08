import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-auth';
import { getSheetData, SHEETS } from '@/lib/sheets';
import { AttendanceRecord, summarizeAttendance, reflectPaidLeaveToAttendance } from '@/lib/attendance';
import { normalizeMonth } from '@/lib/utils';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// 取り込んだ給与データに勤怠記録を紐づけて、勤怠項目（出勤日数・有給・欠勤・勤務時間）を反映する。
// 給与の各行の支給月（＝勤務月）に対応する勤怠記録を集計し、給与シートへ保存する。
export async function POST(request: Request) {
  try {
    const { employeeId } = await request.json();
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeIdが必要です' }, { status: 400 });
    }

    // 先に有給取得記録を勤怠カレンダーへ反映してから集計する（未生成の月は生成しない）
    const leave = await reflectPaidLeaveToAttendance(employeeId, { generateMissing: false });

    const [payrollData, attData] = await Promise.all([
      getSheetData(SHEETS.PAYROLL),
      getSheetData('勤怠記録'),
    ]);

    // 勤怠記録を「月(YYYY-MM) → レコード配列」に集約（対象社員のみ）
    const attByMonth: Record<string, AttendanceRecord[]> = {};
    for (const r of attData.slice(1)) {
      if (r[0] !== employeeId) continue;
      const ym = normalizeMonth(r[1] ?? '');
      if (!ym) continue;
      (attByMonth[ym] ??= []).push({
        employeeId: r[0] ?? '',
        date: r[1] ?? '',
        weekday: r[2] ?? '',
        scheduledHours: Number(r[3]) || 0,
        category: (r[4] as AttendanceRecord['category']) ?? '通常',
        actualHours: Number(r[5]) || 0,
        note: r[6] ?? '',
      });
    }

    const summaryCache: Record<string, ReturnType<typeof summarizeAttendance>> = {};
    const sheets = getSheetsClient();
    const updates: { range: string; values: (string | number)[][] }[] = [];
    const details: { paymentMonth: string; workDays: number; workHours: number; found: boolean }[] = [];

    payrollData.forEach((row, i) => {
      if (i === 0) return; // ヘッダー
      if (row[1] !== employeeId) return;
      const ym = normalizeMonth(row[2] ?? '');
      if (!ym) return;

      const recs = attByMonth[ym] ?? [];
      const summary = (summaryCache[ym] ??= summarizeAttendance(recs));
      const rowNumber = i + 1; // 1始まりの行番号

      // F:出勤日数 G:有給日数 H:欠勤日数 I:勤務時間（J:残業時間は手入力値を保持）
      updates.push({
        range: `${SHEETS.PAYROLL}!F${rowNumber}:I${rowNumber}`,
        values: [[summary.workedDays, summary.paidLeaveDays, summary.absentDays, summary.workedHours]],
      });
      details.push({
        paymentMonth: ym,
        workDays: summary.workedDays,
        workHours: summary.workedHours,
        found: recs.length > 0,
      });
    });

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: '対象の給与データが見つかりません' }, { status: 404 });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: updates },
    });

    const missing = details.filter((d) => !d.found).map((d) => d.paymentMonth);
    return NextResponse.json({
      success: true,
      updated: updates.length,
      leaveSynced: leave.synced,
      message:
        `${updates.length}件の給与データに勤怠を反映しました` +
        (leave.synced > 0 ? `（有給${leave.synced}件を反映）` : '') +
        (missing.length > 0 ? `（勤怠記録なし: ${missing.join(', ')}）` : ''),
      details,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
