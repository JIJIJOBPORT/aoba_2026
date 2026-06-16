import { NextResponse } from 'next/server';
import {
  getAttendanceRecords,
  generateMonthlyAttendance,
  updateAttendanceCategory,
  summarizeAttendance,
} from '@/lib/attendance';

// 勤怠記録取得
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const yearMonth = searchParams.get('yearMonth');

  if (!employeeId || !yearMonth) {
    return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
  }

  try {
    const records = await getAttendanceRecords(employeeId, yearMonth);
    const summary = summarizeAttendance(records);
    return NextResponse.json({ success: true, records, summary });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// 月次カレンダー生成
export async function POST(request: Request) {
  try {
    const { employeeId, yearMonth } = await request.json();
    if (!employeeId || !yearMonth) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }
    const records = await generateMonthlyAttendance(employeeId, yearMonth);
    const summary = summarizeAttendance(records);
    return NextResponse.json({ success: true, records, summary });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// 区分更新
export async function PATCH(request: Request) {
  try {
    const { employeeId, date, category, note } = await request.json();
    await updateAttendanceCategory(employeeId, date, category, note ?? '');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
