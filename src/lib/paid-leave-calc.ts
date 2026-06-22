// 有給休暇の法定計算ロジック（純粋関数・副作用なし）
// 付与日数の自動算定／2年時効による失効／繰越（古い分）からのFIFO消化

import { PaidLeaveUsage } from '@/types';

/** "YYYY/MM/DD" や "YYYY-MM-DD" を Date（ローカル正午）に正規化 */
export function parseDate(s: string): Date {
  const norm = s.replace(/\//g, '-').slice(0, 10);
  return new Date(norm + 'T12:00:00');
}

/** Date を "YYYY-MM-DD" に整形 */
export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** n年後の同月日（うるう年2/29は2/28へ丸め） */
function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  if (r.getMonth() !== ((d.getMonth() + 0) % 12)) {
    // 2/29 → 3/1 になってしまった場合は前日（2/28）へ
    r.setDate(0);
  }
  return r;
}

/** nヶ月後の同月日 */
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const targetMonth = r.getMonth() + n;
  r.setMonth(targetMonth);
  return r;
}

/**
 * 勤続期間（最初の付与＝入社6ヶ月後を起点とした「○年6ヶ月」区分）に対応する
 * 法定付与日数（通常の労働者）。
 * 6ヶ月:10 / 1.5年:11 / 2.5年:12 / 3.5年:14 / 4.5年:16 / 5.5年:18 / 6.5年〜:20
 * @param grantIndex 付与回数（0始まり）。0=入社6ヶ月後の初回付与
 */
export function statutoryGrantDays(grantIndex: number): number {
  const table = [10, 11, 12, 14, 16, 18, 20];
  return grantIndex < table.length ? table[grantIndex] : 20;
}

export interface GrantEvent {
  grantIndex: number;   // 付与回数（0始まり）
  grantDate: string;    // 付与日 YYYY-MM-DD
  expiryDate: string;   // 失効日 YYYY-MM-DD（付与日+2年）
  grantDays: number;    // 付与日数
  fiscalYear: string;   // 管理年度（付与日の年）
}

/**
 * 入社日から asOf 時点までに発生すべき付与イベント一覧を法定通り生成する。
 * 初回付与は入社6ヶ月後、以降は毎年その月日に付与。
 */
export function generateGrantEvents(hireDate: string, asOf: Date = new Date()): GrantEvent[] {
  if (!hireDate) return [];
  const hire = parseDate(hireDate);
  const first = addMonths(hire, 6); // 初回付与日
  const events: GrantEvent[] = [];

  for (let i = 0; i < 50; i++) {
    const grant = i === 0 ? first : addYears(first, i);
    if (grant.getTime() > asOf.getTime()) break; // まだ付与日が来ていない
    const expiry = addYears(grant, 2);
    events.push({
      grantIndex: i,
      grantDate: fmtDate(grant),
      expiryDate: fmtDate(expiry),
      grantDays: statutoryGrantDays(i),
      fiscalYear: String(grant.getFullYear()),
    });
  }
  return events;
}

export interface GrantBalance extends GrantEvent {
  usedDays: number;       // この付与から消化された日数
  expiredDays: number;    // 失効した日数（未使用のまま期限切れ）
  remainingDays: number;  // 現時点で有効な残日数
  isExpired: boolean;     // 失効済みか（asOf > expiry）
}

export interface PaidLeaveBalance {
  grants: GrantBalance[];
  totalRemaining: number;     // 有効な残日数の合計
  totalGranted: number;       // 累計付与日数
  totalUsed: number;          // 累計使用日数
  totalExpired: number;       // 累計失効日数
  nextGrantDate: string | null;   // 次回付与予定日
  nextGrantDays: number | null;   // 次回付与日数
}

/**
 * 付与イベントと取得記録から、FIFO消化＋2年失効を反映した残高を計算する。
 *
 * ルール:
 *  - 取得は「取得日時点で有効な付与」の中から、付与日が古い順（FIFO）に消化する。
 *  - 付与日+2年を過ぎた残日数は失効（捨てられる）。
 *  - asOf 時点の有効残日数を集計する。
 */
export function calcPaidLeaveBalance(
  grantEvents: GrantEvent[],
  usages: PaidLeaveUsage[],
  asOf: Date = new Date()
): PaidLeaveBalance {
  // 付与を古い順に並べ、消化用の残量を持たせる
  const grants: (GrantBalance & { _remain: number })[] = grantEvents
    .slice()
    .sort((a, b) => a.grantDate.localeCompare(b.grantDate))
    .map((g) => ({
      ...g,
      usedDays: 0,
      expiredDays: 0,
      remainingDays: 0,
      isExpired: false,
      _remain: g.grantDays,
    }));

  // 取得を日付順に消化
  const sortedUsages = usages
    .slice()
    .sort((a, b) => parseDate(a.usedDate).getTime() - parseDate(b.usedDate).getTime());

  for (const usage of sortedUsages) {
    const usedAt = parseDate(usage.usedDate);
    let need = usage.usedDays;

    // 取得日時点で有効（付与済み かつ 未失効）な付与を古い順に消化
    for (const g of grants) {
      if (need <= 0) break;
      const grantAt = parseDate(g.grantDate);
      const expiryAt = parseDate(g.expiryDate);
      if (grantAt.getTime() > usedAt.getTime()) continue;  // まだ付与されていない
      if (expiryAt.getTime() <= usedAt.getTime()) continue; // 取得時点で失効済み
      const take = Math.min(g._remain, need);
      g._remain -= take;
      g.usedDays += take;
      need -= take;
    }
    // need が残った場合は付与超過取得（残数より多く取得）。残高はマイナスにせず無視。
  }

  // 失効判定（asOf時点で期限切れの未使用分）
  for (const g of grants) {
    const expiryAt = parseDate(g.expiryDate);
    g.isExpired = expiryAt.getTime() <= asOf.getTime();
    if (g.isExpired) {
      g.expiredDays = g._remain;
      g.remainingDays = 0;
    } else {
      g.remainingDays = g._remain;
    }
  }

  const result: GrantBalance[] = grants.map(({ _remain, ...rest }) => { void _remain; return rest; });

  const totalRemaining = result.reduce((s, g) => s + g.remainingDays, 0);
  const totalGranted = result.reduce((s, g) => s + g.grantDays, 0);
  const totalUsed = result.reduce((s, g) => s + g.usedDays, 0);
  const totalExpired = result.reduce((s, g) => s + g.expiredDays, 0);

  return {
    grants: result,
    totalRemaining,
    totalGranted,
    totalUsed,
    totalExpired,
    nextGrantDate: null,
    nextGrantDays: null,
  };
}

/**
 * 入社日と取得記録から、付与を自動生成して残高を計算する一括ヘルパー。
 * 次回付与予定も算出する。
 */
export function calcFromHireDate(
  hireDate: string,
  usages: PaidLeaveUsage[],
  asOf: Date = new Date()
): PaidLeaveBalance {
  const events = generateGrantEvents(hireDate, asOf);
  const balance = calcPaidLeaveBalance(events, usages, asOf);

  // 次回付与予定（asOf を超える最初の付与）
  if (hireDate) {
    const hire = parseDate(hireDate);
    const first = addMonths(hire, 6);
    for (let i = 0; i < 50; i++) {
      const grant = i === 0 ? first : addYears(first, i);
      if (grant.getTime() > asOf.getTime()) {
        balance.nextGrantDate = fmtDate(grant);
        balance.nextGrantDays = statutoryGrantDays(i);
        break;
      }
    }
  }

  return balance;
}
