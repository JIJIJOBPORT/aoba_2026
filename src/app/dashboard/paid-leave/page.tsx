'use client';

import { useState, useEffect, useCallback } from 'react';
import { Employee } from '@/types';
import { PaidLeaveRecord, PaidLeaveUsage } from '@/types';
import { Gift, CalendarPlus, Trash2 } from 'lucide-react';

const USAGE_TYPES = ['全日', '半日午前', '半日午後', '時間単位'] as const;
const USAGE_TYPE_DAYS: Record<string, number> = { 全日: 1, 半日午前: 0.5, 半日午後: 0.5, 時間単位: 0.125 };

export default function PaidLeavePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [records, setRecords] = useState<PaidLeaveRecord[]>([]);
  const [usages, setUsages] = useState<PaidLeaveUsage[]>([]);

  // 付与フォーム
  const thisYear = new Date().getFullYear().toString();
  const [grantForm, setGrantForm] = useState({
    fiscalYear: thisYear,
    grantDate: '',
    grantDays: '',
    carryoverDays: '0',
    expiryDate: '',
  });
  const [grantSaving, setGrantSaving] = useState(false);

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
    if (d.success) { setRecords(d.records); setUsages(d.usages); }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);

  const handleGrant = async () => {
    if (!grantForm.grantDate || !grantForm.grantDays) {
      setMessage({ type: 'error', text: '付与日と付与日数は必須です' }); return;
    }
    setGrantSaving(true); setMessage(null);
    const res = await fetch('/api/paid-leave/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedId, ...grantForm, grantDays: Number(grantForm.grantDays), carryoverDays: Number(grantForm.carryoverDays) }),
    });
    const d = await res.json();
    setGrantSaving(false);
    setMessage({ type: d.success ? 'success' : 'error', text: d.message ?? d.error });
    if (d.success) { setGrantForm({ fiscalYear: thisYear, grantDate: '', grantDays: '', carryoverDays: '0', expiryDate: '' }); await load(); }
  };

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
    <div className="p-6 max-w-5xl mx-auto">
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

      {/* 残日数サマリー */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {records.slice(0, 3).map(r => (
            <div key={r.fiscalYear} className={`rounded-lg border p-4 ${r === activeRecord ? 'border-[#34675C] bg-[#f0f7f5]' : 'border-gray-200 bg-white opacity-70'}`}>
              <p className="text-xs text-gray-500 mb-1">{r.fiscalYear}年度</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold" style={{ color: '#34675C' }}>{r.remainingDays}</span>
                <span className="text-sm text-gray-500">日残</span>
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <div className="flex justify-between"><span>付与</span><span>{r.grantDays}日</span></div>
                <div className="flex justify-between"><span>繰越</span><span>{r.carryoverDays}日</span></div>
                <div className="flex justify-between"><span>取得</span><span>{r.usedDays}日</span></div>
                <div className="flex justify-between font-medium text-gray-500"><span>期限</span><span>{r.expiryDate}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* 付与登録 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Gift size={15} />有給付与を登録</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">年度</label>
                <input type="text" value={grantForm.fiscalYear} onChange={e => setGrantForm(f => ({ ...f, fiscalYear: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">付与日</label>
                <input type="date" value={grantForm.grantDate} onChange={e => setGrantForm(f => ({ ...f, grantDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">付与日数</label>
                <input type="number" value={grantForm.grantDays} onChange={e => setGrantForm(f => ({ ...f, grantDays: e.target.value }))}
                  placeholder="例: 10" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">繰越日数</label>
                <input type="number" value={grantForm.carryoverDays} onChange={e => setGrantForm(f => ({ ...f, carryoverDays: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">有効期限</label>
              <input type="date" value={grantForm.expiryDate} onChange={e => setGrantForm(f => ({ ...f, expiryDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]" />
            </div>
          </div>
          <button onClick={handleGrant} disabled={grantSaving || !selectedId}
            className="mt-4 w-full py-2.5 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#34675C' }}>
            {grantSaving ? '登録中...' : '付与を登録'}
          </button>
        </div>

        {/* 取得登録 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
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
                      <span className={`text-xs font-medium ${u.usedDate.replace(/\//g, '-') <= today ? 'text-gray-600' : 'text-blue-600'}`}>{u.usedDate}</span>
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
