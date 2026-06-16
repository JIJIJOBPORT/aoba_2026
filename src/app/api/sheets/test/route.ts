import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-auth';

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId || spreadsheetId === 'your_spreadsheet_id_here') {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_SPREADSHEET_ID が .env.local に設定されていません' },
        { status: 400 }
      );
    }

    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = res.data.sheets?.map((s) => s.properties?.title) ?? [];

    return NextResponse.json({
      success: true,
      title: res.data.properties?.title,
      sheets: sheetNames,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
