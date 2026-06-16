import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google-auth';
import { getSheetRows, updateRow, SHEETS } from '@/lib/sheets';
import { Readable } from 'stream';

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 社員フォルダを検索または作成
async function getOrCreateEmployeeFolder(drive: ReturnType<typeof getDriveClient>, employeeName: string): Promise<string> {
  // 既存フォルダを検索
  const search = await drive.files.list({
    q: `name='${employeeName}' and mimeType='application/vnd.google-apps.folder' and '${ROOT_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

  // なければ作成
  const folder = await drive.files.create({
    requestBody: {
      name: employeeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [ROOT_FOLDER_ID!],
    },
    supportsAllDrives: true,
  });

  return folder.data.id!;
}

export async function POST(request: Request) {
  try {
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

    const drive = getDriveClient();
    const buffer = await file.arrayBuffer();

    // ルートフォルダへのアクセス確認
    try {
      await drive.files.get({ fileId: ROOT_FOLDER_ID!, fields: 'id', supportsAllDrives: true });
    } catch {
      return NextResponse.json({
        success: false,
        error: `Driveフォルダにアクセスできません（フォルダID: ${ROOT_FOLDER_ID}）。サービスアカウント aoba2026@aoba2026-499509.iam.gserviceaccount.com をフォルダに「編集者」として共有してください。`,
      }, { status: 500 });
    }

    const stream = Readable.from(Buffer.from(buffer));

    // 社員フォルダを取得または作成
    const folderId = employeeName
      ? await getOrCreateEmployeeFolder(drive, employeeName)
      : ROOT_FOLDER_ID;

    // 同名ファイルが既に存在する場合は削除（常に最新版のみ保持）
    const existing = await drive.files.list({
      q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of existing.data.files ?? []) {
      await drive.files.delete({ fileId: f.id!, supportsAllDrives: true });
    }

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      supportsAllDrives: true,
    });

    const driveFileId = res.data.id!;
    // Appsheet File列用パス: employeeName/filename（aobaフォルダを基準フォルダに設定）
    const filePath = employeeName ? `${employeeName}/${filename}` : filename!;

    // 給与シートのAC列（index 28）にファイルパスを書き込む
    if (payrollId) {
      const rows = await getSheetRows(SHEETS.PAYROLL);
      const index = rows.findIndex((r) => r[0] === payrollId);
      if (index >= 0) {
        const row = [...rows[index]];
        while (row.length < 29) row.push('');
        row[28] = filePath;
        await updateRow(SHEETS.PAYROLL, index + 2, row);
      }
    }

    return NextResponse.json({ success: true, driveId: driveFileId, filePath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
