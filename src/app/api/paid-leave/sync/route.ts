import { NextResponse } from 'next/server';
import { getPaidLeaveUsageByEmployee } from '@/lib/paid-leave';
import { getAttendanceRecords, generateMonthlyAttendance, updateAttendanceCategory } from '@/lib/attendance';

// 有給取得記録シートの内容を勤怠記録に一括反映
export async function POST(request: Request) {
  try {
    const { employeeId } = await request.json();
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeId が必要です' }, { status: 400 });
    }

    const usages = await getPaidLeaveUsageByEmployee(employeeId);
    if (usages.length === 0) {
      return NextResponse.json({ success: true, message: '有給取得記録がありません', synced: 0 });
    }

    // 対象の年月一覧を抽出
    const yearMonths = [...new Set(
      usages.map((u) => u.usedDate.replace(/\//g, '-').slice(0, 7))
    )];

    let synced = 0;
    let generated = 0;
    const errors: string[] = [];

    for (const yearMonth of yearMonths) {
      // 勤怠記録が未生成なら自動生成
      const existing = await getAttendanceRecords(employeeId, yearMonth);
      if (existing.length === 0) {
        await generateMonthlyAttendance(employeeId, yearMonth);
        generated++;
      }

      // 対象月の有給を反映
      const monthUsages = usages.filter((u) =>
        u.usedDate.replace(/\//g, '-').startsWith(yearMonth)
      );

      for (const usage of monthUsages) {
        try {
          const category =
            usage.usageType === '全日' ? '有給' as const :
            usage.usageType === '半日午前' ? '半休午前' as const :
            usage.usageType === '半日午後' ? '半休午後' as const : '有給' as const;

          await updateAttendanceCategory(
            employeeId,
            usage.usedDate,
            category,
            `有給取得（${usage.usageType}）${usage.note ? ' ' + usage.note : ''}`
          );
          synced++;
        } catch (e) {
          errors.push(`${usage.usedDate}: ${String(e)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      generated,
      errors,
      message: `${synced}件の有給を勤怠に反映しました${generated > 0 ? `（${generated}ヶ月分のカレンダーを自動生成）` : ''}`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
