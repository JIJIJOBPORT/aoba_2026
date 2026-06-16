import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google-auth';
import { getSheetRows, updateRow, SHEETS } from '@/lib/sheets';
import { Readable } from 'stream';

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const filename = formData.get('filename') as string | null;
  const employeeName = formData.get('employeeName') as string | null;
  const payrollId = formData.get('payrollId') as string | null;

  if (!file || !filename) {
    return NextResponse.json({ success: false, error: 'ファイルまたはファイル名がありません' }, { status: 400 });
  }

  if (!ROOT_FOLDER_ID || ROOT_FOLDER_ID === 'your_drive_folder_id_here') {
    return NextResponse.json({ success: true, driveId: null, message: 'Drive未設定のためローカル保存のみ' });
  }

  // --- Drive保存 ---
  let driveFileId: string | null = null;
  let filePath: string | null = null;

  try {
    const drive = getDriveClient();
    const buffer = await file.arrayBuffer();
    const stream = Readable.from(Buffer.from(buffer));

    // 同名ファイルが既に存在する場合は削除
    const existing = await drive.files.list({
      q: `name='${filename}' and '${ROOT_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of existing.data.files ?? []) {
      try {
        await drive.files.delete({ fileId: f.id!, supportsAllDrives: true });
      } catch {
        // 削除失敗は無視
      }
    }

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [ROOT_FOLDER_ID],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      supportsAllDrives: true,
    });

    driveFileId = res.data.id!;
    filePath = employeeName ? `${employeeName}/${filename}` : filename;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  // --- スプレッドシート更新（Drive成功後） ---
  if (payrollId && filePath) {
    try {
      const rows = await getSheetRows(SHEETS.PAYROLL);
      const index = rows.findIndex((r) => r[0] === payrollId);
      if (index >= 0) {
        const row = [...rows[index]];
        while (row.length < 29) row.push('');
        row[28] = filePath;
        await updateRow(SHEETS.PAYROLL, index + 2, row);
      }
    } catch {
      // シート更新失敗はDrive保存成功として扱う
    }
  }

  return NextResponse.json({ success: true, driveId: driveFileId, filePath });
}
