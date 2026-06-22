import { NextResponse } from 'next/server';
import { getPaidLeaveByEmployee, getPaidLeaveUsageByEmployee, addPaidLeaveUsage } from '@/lib/paid-leave';
import { getAttendanceRecords, generateMonthlyAttendance, updateAttendanceCategory } from '@/lib/attendance';
import { getEmployeeById } from '@/lib/employees';
import { calcFromHireDate } from '@/lib/paid-leave-calc';

// 有給情報取得（入社日から法定付与・FIFO消化・2年失効を自動計算）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  if (!employeeId) {
    return NextResponse.json({ success: false, error: 'employeeId が必要です' }, { status: 400 });
  }
  try {
    const [records, usages, employee] = await Promise.all([
      getPaidLeaveByEmployee(employeeId),
      getPaidLeaveUsageByEmployee(employeeId),
      getEmployeeById(employeeId),
    ]);

    // 入社日があれば法定計算で残高を算出
    const balance = employee?.hireDate
      ? calcFromHireDate(employee.hireDate, usages)
      : null;

    return NextResponse.json({
      success: true,
      records,
      usages,
      balance,
      hireDate: employee?.hireDate ?? null,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// 有給取得記録を追加 → 勤怠カレンダーに自動反映
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, usedDate, usedDays, usageType, note } = body;

    if (!employeeId || !usedDate || !usageType) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }

    // 1. 有給取得記録シートに追加
    await addPaidLeaveUsage({ employeeId, usedDate, usedDays: Number(usedDays), usageType, note });

    // 2. 対象月の勤怠カレンダーに自動反映
    const yearMonth = usedDate.replace(/\//g, '-').slice(0, 7); // YYYY-MM
    const existing = await getAttendanceRecords(employeeId, yearMonth);

    if (existing.length === 0) {
      // 勤怠記録がなければ自動生成してから更新
      await generateMonthlyAttendance(employeeId, yearMonth);
    }

    // 区分を有給/半休に更新
    const category =
      usageType === '全日' ? '有給' :
      usageType === '半日午前' ? '半休午前' :
      usageType === '半日午後' ? '半休午後' : '有給';

    await updateAttendanceCategory(employeeId, usedDate, category, `有給取得（${usageType}）`);

    return NextResponse.json({
      success: true,
      message: `${usedDate} の勤怠を「${category}」に更新しました`,
      calendarGenerated: existing.length === 0,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
