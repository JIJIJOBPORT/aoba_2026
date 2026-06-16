import { NextResponse } from 'next/server';
import { appendRow, getSheetRows, SHEETS } from '@/lib/sheets';
import { PayrollRecord } from '@/types';

export async function POST(request: Request) {
  try {
    const body: Omit<PayrollRecord, 'id'> = await request.json();

    const rows = await getSheetRows(SHEETS.PAYROLL);
    const isDuplicate = rows.some(
      (r) => r[1] === body.employeeId && r[2] === body.paymentMonth && r[4] === body.recordType
    );
    if (isDuplicate) {
      return NextResponse.json(
        { success: false, error: `${body.paymentMonth}の${body.recordType}データは既に存在します` },
        { status: 409 }
      );
    }

    const id = `P${Date.now()}`;

    await appendRow(SHEETS.PAYROLL, [
      id,
      body.employeeId,
      body.paymentMonth,
      body.paymentDate,
      body.recordType,
      body.workDays,
      body.paidLeaveDays,
      body.absentDays,
      body.workHours,
      body.overtimeHours,
      body.basicSalary,
      body.positionAllowance,
      body.familyAllowance,
      body.housingAllowance,
      body.allowances,
      body.overtimePay,
      body.transportAllowance,
      body.grossPay,
      body.healthInsurance,
      body.pensionInsurance,
      body.employmentInsurance,
      body.longCareInsurance,
      body.childcareSupport,
      body.incomeTax,
      body.residentTax,
      body.totalDeductions,
      body.netPay,
      body.note,
    ]);

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
