import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-auth';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET = '給与・賞与明細履歴';

function parseNum(v: unknown): number {
  return Number(String(v).replace(/,/g, '')) || 0;
}

function generateId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: Request) {
  try {
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'データがありません' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    const appended: string[][] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // CSVの行番号（1行目はヘッダー）

      const employeeId = String(row['社員ID'] ?? '').trim();
      const paymentMonth = String(row['勤務月'] ?? '').trim();

      if (!employeeId || !paymentMonth) {
        errors.push(`行${lineNum}: 社員IDまたは勤務月が空です`);
        continue;
      }

      const basicSalary       = parseNum(row['基本給']);
      const positionAllowance = parseNum(row['役職手当']);
      const familyAllowance   = parseNum(row['家族手当']);
      const housingAllowance  = parseNum(row['住宅手当']);
      const allowances        = parseNum(row['その他手当']);
      const overtimePay       = parseNum(row['時間外手当']);
      const transportAllowance= parseNum(row['交通費']);
      const healthInsurance   = parseNum(row['健康保険']);
      const pensionInsurance  = parseNum(row['厚生年金']);
      const employmentInsurance = parseNum(row['雇用保険']);
      const longCareInsurance = parseNum(row['介護保険']);
      const childcareSupport  = parseNum(row['子育て支援金']);
      const incomeTax         = parseNum(row['所得税']);
      const residentTax       = parseNum(row['住民税']);

      const grossPay = basicSalary + positionAllowance + familyAllowance +
        housingAllowance + allowances + overtimePay + transportAllowance;
      const totalDeductions = healthInsurance + pensionInsurance + employmentInsurance +
        longCareInsurance + childcareSupport + incomeTax + residentTax;
      const netPay = grossPay - totalDeductions;

      appended.push([
        generateId(),
        employeeId,
        paymentMonth,
        String(row['支払日'] ?? '').trim(),
        String(row['区分'] ?? '給与').trim(),
        '0', // workDays
        '0', // paidLeaveDays
        '0', // absentDays
        '0', // workHours
        '0', // overtimeHours
        String(basicSalary),
        String(positionAllowance),
        String(familyAllowance),
        String(housingAllowance),
        String(allowances),
        String(overtimePay),
        String(transportAllowance),
        String(grossPay),
        String(healthInsurance),
        String(pensionInsurance),
        String(employmentInsurance),
        String(longCareInsurance),
        String(childcareSupport),
        String(incomeTax),
        String(residentTax),
        String(totalDeductions),
        String(netPay),
        String(row['備考'] ?? '').trim(),
      ]);
    }

    if (appended.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET}!A:AB`,
        valueInputOption: 'RAW',
        requestBody: { values: appended },
      });
    }

    return NextResponse.json({
      success: true,
      message: `${appended.length}件取込完了${errors.length > 0 ? `（${errors.length}件エラー）` : ''}`,
      imported: appended.length,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
