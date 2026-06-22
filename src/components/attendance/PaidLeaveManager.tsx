'use client';

import { useState, useEffect, useCallback } from 'react';
import { PaidLeaveRecord, PaidLeaveUsage } from '@/types';
import { CalendarPlus, Trash2, CalendarCheck, RefreshCw } from 'lucide-react';

// APIが返す計算済み残高
interface GrantBalance {
  grantIndex: number;
  grantDate: string;
  expiryDate: string;
  grantDays: number;
  fiscalYear: string;
  usedDays: number;
  expiredDays: number;
  remainingDays: number;
  isExpired: boolean;
}
interface PaidLeaveBalance {
  grants: GrantBalance[];
  totalRemaining: number;
  totalGranted: number;
  totalUsed: number;
  totalExpired: number;
  nextGrantDate: string | null;
  nextGrantDays: number | null;
}

interface Props {
  employeeId: string;
  employeeName: string;
  onSaved: () => void;
}

const USAGE_TYPES = ['全日', '半日午前', '半日午後', '時間単位'] as const;

const USAGE_TYPE_DAYS: Record<string, number> = {
  全日: 1,
  半日午前: 0.5,
  半日午後: 0.5,
  時間単位: 0.125,
};

export default function PaidLeaveManager({ employeeId, employeeName, onSaved }: Props) {
  const [leaveRecords, setLeaveRecords] = useState<PaidLeaveRecord[]>([]);
  const [usages, setUsages] = useState<PaidLeaveUsage[]>([]);
  const [balance, setBalance] = useState<PaidLeaveBalance | null>(null);
  const [hireDate, setHireDate] = useState<string | null>(null);
  const [form, setForm] = useState({ usedDate: '', usageType: '全日' as typeof USAGE_TYPES[number], note: '' });
  const [saving, setSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [lastCalcTime, setLastCalcTime] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/paid-leave?employeeId=${employeeId}`);
      const d = await res.json();
      if (d.success) {
        setLeaveRecords(d.records);
        setUsages(d.usages);
        setBalance(d.balance ?? null);
        setHireDate(d.hireDate ?? null);
      }
    } catch {
      // fetch失敗時は無視して空のまま表示
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  // スプレッドシートから再読み込みして残高を再計算
  const handleRecalculate = async () => {
    setRecalculating(true);
    setMessage(null);
    try {
      await load();
      setLastCalcTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setMessage({ type: 'success', text: 'スプレッドシートから再計算しました' });
    } catch {
      setMessage({ type: 'error', text: '再計算に失敗しました' });
    } finally {
      setRecalculating(false);
    }
  };

  // 旧シート方式のフォールバック（入社日が未登録で計算できない場合）
  const activeRecord = leaveRecords.find((r) => r.remainingDays > 0);

  const handleAdd = async () => {
    if (!form.usedDate) { setMessage({ type: 'error', text: '取得日を入力してください' }); return; }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/paid-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          usedDate: form.usedDate,
          usedDays: USAGE_TYPE_DAYS[form.usageType],
          usageType: form.usageType,
          note: form.note,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setMessage({ type: 'success', text: d.message });
        setForm({ usedDate: '', usageType: '全日', note: '' });
        await load();
        onSaved();
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (usage: PaidLeaveUsage) => {
    if (!confirm(`${usage.usedDate} の有給取得を削除しますか？\n勤怠記録も「通常」に戻ります。`)) return;
    setDeletingDate(usage.usedDate);
    setMessage(null);
    try {
      const res = await fetch('/api/paid-leave/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, usedDate: usage.usedDate }),
      });
      const d = await res.json();
      if (d.success) {
        setMessage({ type: 'success', text: d.message });
        await load();
        onSaved();
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setDeletingDate(null);
    }
  };

  // 取得済み・予定を分類
  const today = new Date().toISOString().slice(0, 10);
  const past = usages.filter((u) => u.usedDate.replace(/\//g, '-') <= today);
  const future = usages.filter((u) => u.usedDate.replace(/\//g, '-') > today);

  return (
    <div className="space-y-4">
      {/* 再計算ボタン */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {lastCalcTime ? `最終計算: ${lastCalcTime}` : 'スプレッドシートの内容から自動計算しています'}
        </p>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#34675C] text-white rounded-lg hover:bg-[#2a5249] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? '再計算中...' : 'スプレッドシートから再計算'}
        </button>
      </div>

      {/* 残日数サマリー（法定計算ベース） */}
      {balance ? (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-xs text-green-600 mb-1">{employeeName} の有給残日数</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-700">{balance.totalRemaining}</span>
            <span className="text-sm text-green-600">日</span>
            <span className="text-xs text-gray-500 ml-2">
              累計付与 {balance.totalGranted}日 − 使用 {balance.totalUsed}日 − 失効 {balance.totalExpired}日
            </span>
          </div>
          {balance.nextGrantDate && (
            <p className="text-xs text-gray-400 mt-1">
              次回付与: {balance.nextGrantDate}（+{balance.nextGrantDays}日）
            </p>
          )}

          {/* 付与年度別の内訳 */}
          {balance.grants.length > 0 && (
            <div className="mt-3 border-t border-green-200 pt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-left font-normal pb-1">付与日</th>
                    <th className="text-right font-normal pb-1">付与</th>
                    <th className="text-right font-normal pb-1">使用</th>
                    <th className="text-right font-normal pb-1">失効</th>
                    <th className="text-right font-normal pb-1">残</th>
                    <th className="text-right font-normal pb-1">期限</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.grants.map((g) => (
                    <tr key={g.grantDate} className={g.isExpired ? 'text-gray-300' : 'text-gray-600'}>
                      <td className="text-left py-0.5">{g.grantDate}</td>
                      <td className="text-right">{g.grantDays}</td>
                      <td className="text-right">{g.usedDays}</td>
                      <td className="text-right">{g.expiredDays > 0 ? <span className="text-red-400">{g.expiredDays}</span> : '−'}</td>
                      <td className="text-right font-semibold">{g.remainingDays}</td>
                      <td className="text-right">{g.expiryDate}{g.isExpired && '（失効）'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : !hireDate ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          {employeeName} の入社日が未登録のため、有給を自動計算できません。社員マスタに入社日を登録してください。
          {activeRecord && (
            <p className="mt-1 text-gray-500">（暫定表示）残 {activeRecord.remainingDays}日</p>
          )}
        </div>
      ) : null}

      {/* 入力フォーム */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <CalendarPlus size={15} />
          有給取得を登録（事前・事後どちらでも可）
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">取得日</label>
            <input
              type="date"
              value={form.usedDate}
              onChange={(e) => setForm((f) => ({ ...f, usedDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">種別</label>
            <select
              value={form.usageType}
              onChange={(e) => setForm((f) => ({ ...f, usageType: e.target.value as typeof USAGE_TYPES[number] }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
            >
              {USAGE_TYPES.map((t) => <option key={t} value={t}>{t}（{USAGE_TYPE_DAYS[t]}日）</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">備考（任意）</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="例：私用、通院など"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !form.usedDate}
          className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '登録中...' : '登録（勤怠カレンダーも自動更新）'}
        </button>
        {message && (
          <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* 予定（未来の有給） */}
      {future.length > 0 && (
        <div className="bg-white border border-[#a8c8c0] rounded-lg overflow-hidden">
          <div className="bg-[#f0f5f4] px-4 py-2 flex items-center gap-2 border-b border-[#a8c8c0]">
            <CalendarCheck size={14} className="text-[#34675C]" />
            <h3 className="text-sm font-semibold text-[#34675C]">取得予定（{future.length}件）</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {future.map((u) => (
              <UsageRow key={u.usedDate} usage={u} onDelete={handleDelete} deletingDate={deletingDate} isPast={false} />
            ))}
          </ul>
        </div>
      )}

      {/* 取得済み */}
      {past.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-600">取得済み（{past.length}件）</h3>
          </div>
          <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {[...past].reverse().map((u) => (
              <UsageRow key={u.usedDate} usage={u} onDelete={handleDelete} deletingDate={deletingDate} isPast={true} />
            ))}
          </ul>
        </div>
      )}

      {usages.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm bg-white border border-gray-200 rounded-lg">
          有給取得記録がありません
        </div>
      )}
    </div>
  );
}

function UsageRow({ usage, onDelete, deletingDate, isPast }: {
  usage: PaidLeaveUsage;
  onDelete: (u: PaidLeaveUsage) => void;
  deletingDate: string | null;
  isPast: boolean;
}) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-gray-400' : 'bg-[#86AC41]'}`} />
        <div>
          <p className="text-sm font-medium text-gray-700">{usage.usedDate}</p>
          <p className="text-xs text-gray-400">
            {usage.usageType}（{usage.usedDays}日）{usage.note && `・${usage.note}`}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(usage)}
        disabled={deletingDate === usage.usedDate}
        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
      >
        <Trash2 size={12} />
        {deletingDate === usage.usedDate ? '削除中...' : '削除'}
      </button>
    </li>
  );
}
