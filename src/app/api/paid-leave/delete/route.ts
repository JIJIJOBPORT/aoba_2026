import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { getSheetsClient } from '@/lib/google-auth';
import { getAttendanceRecords, generateMonthlyAttendance, updateAttendanceCategory } from '@/lib/attendance';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET = '有給取得記録';

export async function DELETE(request: Request) {
  try {
    const { employeeId, usedDate } = await request.json();
    if (!employeeId || !usedDate) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    const allData = await getSheetData(SHEET);
    const normalizedTarget = usedDate.replace(/\//g, '-');

    // 対象行を検索
    const rowIndex = allData.findIndex(
      (r, i) => i > 0 &&
        r[0] === employeeId &&
        r[1].replace(/\//g, '-') === normalizedTarget
    );
    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: '対象レコードが見つかりません' }, { status: 404 });
    }

    // 行を削除（deleteRowsリクエスト）
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === SHEET);
    const sheetId = sheet?.properties?.sheetId ?? 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        }],
      },
    });

    // 勤怠記録も「通常」に戻す（カレンダーが存在する場合のみ）
    const yearMonth = normalizedTarget.slice(0, 7);
    const existing = await getAttendanceRecords(employeeId, yearMonth);
    if (existing.length > 0) {
      try {
        await updateAttendanceCategory(employeeId, usedDate, '通常', '');
      } catch {
        // 勤怠記録がない日（定休など）は無視
      }
    }

    return NextResponse.json({
      success: true,
      message: `${usedDate} の有給取得を削除し、勤怠を「通常」に戻しました`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
