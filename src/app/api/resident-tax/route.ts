import { NextResponse } from 'next/server';
import { getSheetRows, appendRow, updateRow, SHEETS } from '@/lib/sheets';

const SHEET = '住民税マスタ';

// GET: 社員IDと年度で取得（または月で1件取得）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const yearMonth = searchParams.get('yearMonth'); // 単月取得用

  try {
    const rows = await getSheetRows(SHEET);
    let filtered = rows.filter((r) => !employeeId || r[0] === employeeId);
    if (yearMonth) {
      filtered = filtered.filter((r) => r[1] === yearMonth);
    }
    const data = filtered.map((r, i) => ({
      _rowIndex: i,
      employeeId: r[0] ?? '',
      yearMonth: r[1] ?? '',
      amount: Number(r[2] ?? 0),
      status: (r[3] ?? '未払') as '未払' | '支払済',
      paidDate: r[4] ?? '',
    }));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// POST: 1年分一括登録
export async function POST(request: Request) {
  const body = await request.json();
  const { employeeId, year, months } = body;
  // months: { [MM]: amount } 例: { "06": 4900, "07": 4900, ... }

  if (!employeeId || !year || !months) {
    return NextResponse.json({ success: false, error: 'パラメータ不足' }, { status: 400 });
  }

  try {
    const rows = await getSheetRows(SHEET);
    let added = 0;
    let updated = 0;

    for (const [mm, amount] of Object.entries(months)) {
      if (!amount) continue;
      // 6〜12月は同年、1〜5月は翌年（住民税は6月始まり）
      const monthNum = parseInt(mm);
      const actualYear = monthNum >= 6 ? parseInt(year) : parseInt(year) + 1;
      const yearMonth = `${actualYear}-${mm}`;
      const existingIndex = rows.findIndex((r) => r[0] === employeeId && r[1] === yearMonth);

      if (existingIndex >= 0) {
        // 既存行を更新（金額のみ、支払状況は維持）
        await updateRow(SHEET, existingIndex + 2, [employeeId, yearMonth, amount, rows[existingIndex][3] ?? '未払', rows[existingIndex][4] ?? '']);
        updated++;
      } else {
        await appendRow(SHEET, [employeeId, yearMonth, amount, '未払', '']);
        added++;
      }
    }

    return NextResponse.json({ success: true, message: `${added}件追加・${updated}件更新しました` });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// PATCH: 支払状況の更新
export async function PATCH(request: Request) {
  const body = await request.json();
  const { employeeId, yearMonth, status, paidDate } = body;

  try {
    const rows = await getSheetRows(SHEET);
    const index = rows.findIndex((r) => r[0] === employeeId && r[1] === yearMonth);
    if (index < 0) {
      return NextResponse.json({ success: false, error: 'データが見つかりません' }, { status: 404 });
    }
    await updateRow(SHEET, index + 2, [
      rows[index][0],
      rows[index][1],
      rows[index][2],
      status,
      paidDate ?? rows[index][4] ?? '',
    ]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
