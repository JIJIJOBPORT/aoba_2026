import { NextResponse } from 'next/server';
import { getSheetRows, SHEETS, parseNumber } from '@/lib/sheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const paymentMonth = searchParams.get('paymentMonth'); // YYYY-MM (current month)
  if (!employeeId || !paymentMonth) {
    return NextResponse.json({ success: false, error: 'パラメータ不足' }, { status: 400 });
  }

  // 前月を計算
  const [y, m] = paymentMonth.split('-').map(Number);
  const prevMonth = m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, '0')}`;

  try {
    const rows = await getSheetRows(SHEETS.PAYROLL);
    const row = rows.find((r) => r[1] === employeeId && r[2] === prevMonth);
    if (!row) {
      return NextResponse.json({ success: false, error: `${prevMonth} のデータが見つかりません` });
    }

    return NextResponse.json({
      success: true,
      data: {
        basicSalary: parseNumber(row[10]),
        positionAllowance: parseNumber(row[11]),
        familyAllowance: parseNumber(row[12]),
        housingAllowance: parseNumber(row[13]),
        allowances: parseNumber(row[14]),
        overtimePay: parseNumber(row[15]),
        transportAllowance: parseNumber(row[16]),
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
