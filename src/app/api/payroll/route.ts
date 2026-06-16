import { NextResponse } from 'next/server';
import { getPayrollByEmployee } from '@/lib/payroll';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeId が必要です' }, { status: 400 });
    }
    const records = await getPayrollByEmployee(employeeId);
    return NextResponse.json({ success: true, data: records });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
