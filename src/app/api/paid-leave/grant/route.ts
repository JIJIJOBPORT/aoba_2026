import { NextResponse } from 'next/server';
import { appendRow, getSheetRows, SHEETS } from '@/lib/sheets';

// 有給付与を登録
export async function POST(request: Request) {
  const body = await request.json();
  const { employeeId, fiscalYear, grantDate, grantDays, carryoverDays, expiryDate } = body;

  if (!employeeId || !fiscalYear || !grantDate || !grantDays) {
    return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
  }

  try {
    // 既存の使用日数を集計
    const usageRows = await getSheetRows('有給取得記録');
    const usedDays = usageRows
      .filter((r) => r[0] === employeeId && r[1].startsWith(fiscalYear))
      .reduce((sum, r) => sum + Number(r[2] ?? 0), 0);

    const remaining = Number(grantDays) + Number(carryoverDays ?? 0) - usedDays;

    await appendRow(SHEETS.PAID_LEAVE, [
      employeeId,
      fiscalYear,
      grantDate,
      Number(grantDays),
      Number(carryoverDays ?? 0),
      usedDays,
      remaining,
      expiryDate ?? '',
    ]);

    return NextResponse.json({ success: true, message: `${fiscalYear}年度の有給付与を登録しました（${grantDays}日）` });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
