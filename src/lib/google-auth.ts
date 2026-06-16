import { google } from 'googleapis';
import path from 'path';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

export function getAuthClient() {
  // Vercel環境: 環境変数にJSONを直接入れる方式
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    const credentials = JSON.parse(jsonEnv);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
    return auth;
  }

  // ローカル環境: ファイルパスで読み込む方式
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH または GOOGLE_SERVICE_ACCOUNT_JSON が必要です');

  const resolvedPath = path.resolve(process.cwd(), keyPath);
  const auth = new google.auth.GoogleAuth({
    keyFile: resolvedPath,
    scopes: SCOPES,
  });

  return auth;
}

export function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

export function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}
