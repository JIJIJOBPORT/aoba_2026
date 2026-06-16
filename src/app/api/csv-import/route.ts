import { NextResponse } from 'next/server';
import { getSheetData, SHEETS } from '@/lib/sheets';
import { getSheetsClient } from '@/lib/google-auth';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// CSVの形式:
// 社員ID, 支給月, 区分, 健康保険料, 厚生年金, 雇用保険, 介護保険, 子育て支援金, 所得税, 住民税
export async function POST(request: Request) {
  try {
    const { rows, paymentMonth } = await request.json() as {
      rows: Record<string, string>[];
      paymentMonth: string;
    };

    if (!rows?.length || !paymentMonth) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }

    // 給与明細履歴シートの全データを取得
    const allData = await getSheetData(SHEETS.PAYROLL);
    const header = allData[0];
    const dataRows = allData.slice(1);

    const sheets = getSheetsClient();
    const updated: string[] = [];
    const notFound: string[] = [];

    for (const csvRow of rows) {
      const employeeId = csvRow['社員ID'] ?? csvRow['employee_id'];
      if (!employeeId) continue;

      // 対象行を検索（社員ID + 支給月 + 区分が一致）
      const recordType = csvRow['区分'] ?? '給与';
      const rowIndex = dataRows.findIndex(
        (r) => r[1] === employeeId && r[2] === paymentMonth && r[3] === recordType
      );

      if (rowIndex === -1) {
        notFound.push(employeeId);
        continue;
      }

      const sheetRowIndex = rowIndex + 2; // 1行目ヘッダー + 0始まり補正
      const existingRow = dataRows[rowIndex];

      // 既存データを更新（CSVにある項目のみ上書き）
      const updatedRow = [...existingRow];
      const colMap: Record<string, number> = {
        '健康保険料': 8,
        '厚生年金保険料': 9,
        '雇用保険料': 10,
        '介護保険料': 11,
        '子ども・子育て支援金': 12,
        '所得税': 13,
        '住民税': 14,
      };

      for (const [key, colIdx] of Object.entries(colMap)) {
        if (csvRow[key] !== undefined) {
          updatedRow[colIdx] = csvRow[key];
        }
      }

      // 控除合計・差引支給額を再計算
      const deductions = [8, 9, 10, 11, 12, 13, 14].reduce(
        (sum, i) => sum + (Number(updatedRow[i]) || 0),
        0
      );
      updatedRow[15] = String(deductions);
      updatedRow[16] = String((Number(updatedRow[7]) || 0) - deductions);

      // シートを更新
      const colEnd = String.fromCharCode(65 + updatedRow.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.PAYROLL}!A${sheetRowIndex}:${colEnd}${sheetRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [updatedRow] },
      });

      updated.push(employeeId);
    }

    return NextResponse.json({
      success: true,
      updated: updated.length,
      notFound,
      message: `${updated.length}件更新、${notFound.length}件未一致`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
