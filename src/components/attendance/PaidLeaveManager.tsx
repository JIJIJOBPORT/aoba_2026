'use client';

import { useState, useEffect, useCallback } from 'react';
import { PaidLeaveRecord, PaidLeaveUsage } from '@/types';
import { CalendarPlus, Trash2, CalendarCheck } from 'lucide-react';

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
  const [form, setForm] = useState({ usedDate: '', usageType: '全日' as typeof USAGE_TYPES[number], note: '' });
  const [saving, setSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/paid-leave?employeeId=${employeeId}`);
      const d = await res.json();
      if (d.success) {
        setLeaveRecords(d.records);
        setUsages(d.usages);
      }
    } catch {
      // fetch失敗時は無視して空のまま表示
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

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
      {/* 残日数サマリー */}
      {activeRecord && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-xs text-green-600 mb-1">{employeeName} の有給残日数</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-700">{activeRecord.remainingDays}</span>
            <span className="text-sm text-green-600">日</span>
            <span className="text-xs text-gray-500 ml-2">
              付与 {activeRecord.grantDays}日 ＋ 繰越 {activeRecord.carryoverDays}日 − 使用 {activeRecord.usedDays}日
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">有効期限: {activeRecord.expiryDate}</p>
        </div>
      )}

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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">種別</label>
            <select
              value={form.usageType}
              onChange={(e) => setForm((f) => ({ ...f, usageType: e.target.value as typeof USAGE_TYPES[number] }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 flex items-center gap-2 border-b border-blue-200">
            <CalendarCheck size={14} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-700">取得予定（{future.length}件）</h3>
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
        <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-gray-400' : 'bg-blue-500'}`} />
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
