import { NextResponse } from 'next/server';
import { getSheetData, SHEETS } from '@/lib/sheets';
import { getSheetsClient } from '@/lib/google-auth';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// 国税庁CSVの列構成（ヘッダー行あり）:
// 適用年度, 以上, 未満, 扶養0人, 扶養1人, 扶養2人, 扶養3人, 扶養4人, 扶養5人, 扶養6人, 扶養7人以上
export async function POST(request: Request) {
  try {
    const { rows, year, overwrite } = await request.json() as {
      rows: Record<string, string>[];
      year: string;
      overwrite: boolean;
    };

    if (!rows?.length || !year) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const sheets = getSheetsClient();

    if (overwrite) {
      // 対象年度の既存データを削除してから再登録
      const allData = await getSheetData(SHEETS.WITHHOLDING_TAX);
      const header = allData[0] ?? [];
      const otherRows = allData.slice(1).filter((r) => r[0] !== year);

      // シートを全クリアして書き直す
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.WITHHOLDING_TAX,
      });

      const newRows = [
        header.length > 0 ? header : ['適用年度', '以上', '未満', '扶養0人', '扶養1人', '扶養2人', '扶養3人', '扶養4人', '扶養5人', '扶養6人', '扶養7人以上'],
        ...otherRows,
      ];

      // CSVデータを追加
      for (const row of rows) {
        newRows.push([
          year,
          row['以上'] ?? row['lower'] ?? '',
          row['未満'] ?? row['upper'] ?? '',
          row['扶養0人'] ?? row['dep0'] ?? '0',
          row['扶養1人'] ?? row['dep1'] ?? '0',
          row['扶養2人'] ?? row['dep2'] ?? '0',
          row['扶養3人'] ?? row['dep3'] ?? '0',
          row['扶養4人'] ?? row['dep4'] ?? '0',
          row['扶養5人'] ?? row['dep5'] ?? '0',
          row['扶養6人'] ?? row['dep6'] ?? '0',
          row['扶養7人以上'] ?? row['dep7'] ?? '0',
        ]);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.WITHHOLDING_TAX}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows },
      });
    } else {
      // 追記モード
      const appendRows = rows.map((row) => [
        year,
        row['以上'] ?? row['lower'] ?? '',
        row['未満'] ?? row['upper'] ?? '',
        row['扶養0人'] ?? row['dep0'] ?? '0',
        row['扶養1人'] ?? row['dep1'] ?? '0',
        row['扶養2人'] ?? row['dep2'] ?? '0',
        row['扶養3人'] ?? row['dep3'] ?? '0',
        row['扶養4人'] ?? row['dep4'] ?? '0',
        row['扶養5人'] ?? row['dep5'] ?? '0',
        row['扶養6人'] ?? row['dep6'] ?? '0',
        row['扶養7人以上'] ?? row['dep7'] ?? '0',
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.WITHHOLDING_TAX,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: appendRows },
      });
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      message: `${year}年度の源泉所得税データを${rows.length}件登録しました`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
