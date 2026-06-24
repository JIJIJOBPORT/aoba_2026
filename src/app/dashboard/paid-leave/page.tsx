'use client';

import { useState, useEffect, useCallback } from 'react';
import { Employee } from '@/types';
import { PaidLeaveRecord, PaidLeaveUsage } from '@/types';
import { CalendarPlus, Trash2 } from 'lucide-react';

// APIが返す計算済み残高（FIFO消化＋2年失効）
interface GrantBalance {
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

const USAGE_TYPES = ['全日', '半日午前', '半日午後', '時間単位'] as const;
const USAGE_TYPE_DAYS: Record<string, number> = { 全日: 1, 半日午前: 0.5, 半日午後: 0.5, 時間単位: 0.125 };

export default function PaidLeavePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [records, setRecords] = useState<PaidLeaveRecord[]>([]);
  const [usages, setUsages] = useState<PaidLeaveUsage[]>([]);
  const [balance, setBalance] = useState<PaidLeaveBalance | null>(null);
  const [hireDate, setHireDate] = useState<string | null>(null);

  // 取得フォーム
  const [usageForm, setUsageForm] = useState({ usedDate: '', usageType: '全日' as typeof USAGE_TYPES[number], note: '' });
  const [usageSaving, setUsageSaving] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => {
      if (d.success) { setEmployees(d.data); if (d.data[0]) setSelectedId(d.data[0].id); }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/paid-leave?employeeId=${selectedId}`);
    const d = await res.json();
    if (d.success) {
      setRecords(d.records);
      setUsages(d.usages);
      setBalance(d.balance ?? null);
      setHireDate(d.hireDate ?? null);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);

  const handleUsage = async () => {
    if (!usageForm.usedDate) { setMessage({ type: 'error', text: '取得日を入力してください' }); return; }
    setUsageSaving(true); setMessage(null);
    const res = await fetch('/api/paid-leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedId, usedDate: usageForm.usedDate, usedDays: USAGE_TYPE_DAYS[usageForm.usageType], usageType: usageForm.usageType, note: usageForm.note }),
    });
    const d = await res.json();
    setUsageSaving(false);
    setMessage({ type: d.success ? 'success' : 'error', text: d.message ?? d.error });
    if (d.success) { setUsageForm({ usedDate: '', usageType: '全日', note: '' }); await load(); }
  };

  const handleDelete = async (usage: PaidLeaveUsage) => {
    if (!confirm(`${usage.usedDate} の有給を削除しますか？`)) return;
    setDeletingDate(usage.usedDate);
    const res = await fetch('/api/paid-leave/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedId, usedDate: usage.usedDate }),
    });
    const d = await res.json();
    setDeletingDate(null);
    setMessage({ type: d.success ? 'success' : 'error', text: d.message ?? d.error });
    if (d.success) await load();
  };

  const activeRecord = records.find(r => r.remainingDays > 0) ?? records[0];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">有給管理</h1>

      {/* 社員選択 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5 flex items-center gap-4">
        <label className="text-xs text-gray-500">社員</label>
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setMessage(null); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
        >
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {message && (
          <span className={`text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </span>
        )}
      </div>

      {/* 残日数サマリー（FIFO消化＋2年失効を反映した有効残） */}
      {balance ? (
        <div className="rounded-lg border border-[#34675C] bg-[#f0f7f5] p-5 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* メインの残日数 */}
            <div>
              <p className="text-xs text-gray-500 mb-1">現在の有効な有給残（失効分を除く）</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ color: '#34675C' }}>{balance.totalRemaining}</span>
                <span className="text-sm text-gray-500">日</span>
              </div>
              <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                <div>累計付与 {balance.totalGranted}日 − 使用 {balance.totalUsed}日 − 失効 {balance.totalExpired}日</div>
                {balance.nextGrantDate && (
                  <div className="text-gray-400">次回付与: {balance.nextGrantDate}（+{balance.nextGrantDays}日）</div>
                )}
              </div>
            </div>

            {/* 付与年度別の内訳 */}
            {balance.grants.length > 0 && (
              <div className="flex-1 min-w-full sm:min-w-[280px] overflow-x-auto">
                <table className="w-full min-w-[280px] text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-200">
                      <th className="text-left font-normal pb-1">付与日</th>
                      <th className="text-right font-normal pb-1">付与</th>
                      <th className="text-right font-normal pb-1">使用</th>
                      <th className="text-right font-normal pb-1">失効</th>
                      <th className="text-right font-normal pb-1">残</th>
                      <th className="text-right font-normal pb-1">期限</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.grants.filter(g => !g.isExpired || g.usedDays > 0 || g.expiredDays > 0).slice(-4).map(g => (
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
        </div>
      ) : !hireDate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-5 text-xs text-amber-700">
          {employees.find(e => e.id === selectedId)?.name ?? 'この社員'} の入社日が社員マスタに未登録のため、有給を自動計算できません。入社日を登録してください。
          {activeRecord && <span className="ml-2 text-gray-500">（暫定）残 {activeRecord.remainingDays}日</span>}
        </div>
      ) : null}

      <div className="max-w-xl">
        {/* 取得登録 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-xs text-gray-400 mb-3">
            有給の付与は入社日から自動計算されます。ここでは取得（消化）のみ登録してください。
          </p>
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><CalendarPlus size={15} />有給取得を登録</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">取得日</label>
              <input type="date" value={usageForm.usedDate} onChange={e => setUsageForm(f => ({ ...f, usedDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">種別</label>
              <select value={usageForm.usageType} onChange={e => setUsageForm(f => ({ ...f, usageType: e.target.value as typeof USAGE_TYPES[number] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]">
                {USAGE_TYPES.map(t => <option key={t} value={t}>{t}（{USAGE_TYPE_DAYS[t]}日）</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">備考（任意）</label>
              <input type="text" value={usageForm.note} onChange={e => setUsageForm(f => ({ ...f, note: e.target.value }))}
                placeholder="例：私用、通院など"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
            </div>
          </div>
          <button onClick={handleUsage} disabled={usageSaving || !usageForm.usedDate || !selectedId}
            className="mt-4 w-full py-2.5 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#86AC41' }}>
            {usageSaving ? '登録中...' : '取得を登録（勤怠も自動更新）'}
          </button>

          {/* 取得履歴 */}
          {usages.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 border-b">取得履歴</div>
              <ul className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                {[...usages].sort((a, b) => b.usedDate.localeCompare(a.usedDate)).map(u => (
                  <li key={u.usedDate} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                    <div>
                      <span className={`text-xs font-medium ${u.usedDate.replace(/\//g, '-') <= today ? 'text-gray-600' : 'text-[#34675C]'}`}>{u.usedDate}</span>
                      <span className="text-xs text-gray-400 ml-2">{u.usageType}（{u.usedDays}日）{u.note && `・${u.note}`}</span>
                    </div>
                    <button onClick={() => handleDelete(u)} disabled={deletingDate === u.usedDate}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50">
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
