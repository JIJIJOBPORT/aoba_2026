import { NextResponse } from 'next/server';
import { getSheetRows, deleteRow, SHEETS } from '@/lib/sheets';

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'idが必要です' }, { status: 400 });

    const rows = await getSheetRows(SHEETS.PAYROLL);
    const index = rows.findIndex((r) => r[0] === id);
    if (index < 0) return NextResponse.json({ success: false, error: 'レコードが見つかりません' }, { status: 404 });

    await deleteRow(SHEETS.PAYROLL, index + 2); // +1 for header, +1 for 1-based
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
