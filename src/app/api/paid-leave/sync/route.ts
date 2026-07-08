import { NextResponse } from 'next/server';
import { reflectPaidLeaveToAttendance } from '@/lib/attendance';

// 有給取得記録シートの内容を勤怠記録に一括反映
export async function POST(request: Request) {
  try {
    const { employeeId } = await request.json();
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeId が必要です' }, { status: 400 });
    }

    const { synced, generated, errors } = await reflectPaidLeaveToAttendance(employeeId);

    return NextResponse.json({
      success: true,
      synced,
      generated,
      errors,
      message:
        synced === 0 && generated === 0
          ? '反映対象の有給取得記録がありません'
          : `${synced}件の有給を勤怠に反映しました${generated > 0 ? `（${generated}ヶ月分のカレンダーを自動生成）` : ''}`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
