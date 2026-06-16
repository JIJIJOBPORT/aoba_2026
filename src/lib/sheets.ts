import { getSheetsClient } from './google-auth';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// シート名の定数
export const SHEETS = {
  EMPLOYEES: '社員マスタ',
  PAYROLL: '給与・賞与明細履歴',
  EMPLOYMENT_INSURANCE: '雇用保険料率マスタ',
  SOCIAL_INSURANCE: '社会保険料率マスタ',
  PAID_LEAVE: '有給管理',
  WITHHOLDING_TAX: '源泉所得税マスタ',
} as const;

// 指定シートの全データを取得
export async function getSheetData(sheetName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  return (response.data.values ?? []).map((row) =>
    (row as (string | number | boolean)[]).map((cell) => String(cell ?? ''))
  );
}

// カンマ区切りの数値文字列を数値に変換
export function parseNumber(value: string): number {
  return Number(String(value).replace(/,/g, '')) || 0;
}

// 指定シートの1行目（ヘッダー）を除いたデータを取得
export async function getSheetRows(sheetName: string): Promise<string[][]> {
  const rows = await getSheetData(sheetName);
  return rows.slice(1);
}

// シートに行を追加
export async function appendRow(sheetName: string, values: (string | number | boolean)[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// 指定行を更新（rowIndex: 2始まり = データ1行目）
export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: (string | number | boolean)[]
): Promise<void> {
  const sheets = getSheetsClient();
  const colEnd = columnLetter(values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:${colEnd}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// 指定行を削除（rowIndex: 2始まり = データ1行目）
export async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
  const sheets = getSheetsClient();
  // シートIDをシート名から取得
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet?.properties?.sheetId === undefined) throw new Error(`シート "${sheetName}" が見つかりません`);
  const sheetId = sheet!.properties!.sheetId!;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex,       // exclusive
          },
        },
      }],
    },
  });
}

// 列番号をアルファベットに変換 (1→A, 26→Z, 27→AA)
function columnLetter(col: number): string {
  let result = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    col = Math.floor((col - 1) / 26);
  }
  return result;
}
