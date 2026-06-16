import { NextResponse } from 'next/server';
import { getSheetRows, updateRow, SHEETS } from '@/lib/sheets';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, workDays, paidLeaveDays, absentDays, workHours, overtimeHours, note } = body;

    if (!id) return NextResponse.json({ success: false, error: 'idが必要です' }, { status: 400 });

    const rows = await getSheetRows(SHEETS.PAYROLL);
    const index = rows.findIndex((r) => r[0] === id);
    if (index < 0) return NextResponse.json({ success: false, error: 'レコードが見つかりません' }, { status: 404 });

    const row = [...rows[index]];
    if (workDays !== undefined) row[5] = String(workDays);
    if (paidLeaveDays !== undefined) row[6] = String(paidLeaveDays);
    if (absentDays !== undefined) row[7] = String(absentDays);
    if (workHours !== undefined) row[8] = String(workHours);
    if (overtimeHours !== undefined) row[9] = String(overtimeHours);
    if (note !== undefined) row[27] = String(note);

    await updateRow(SHEETS.PAYROLL, index + 2, row);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
