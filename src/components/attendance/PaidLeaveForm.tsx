'use client';

import { useState } from 'react';
import { PaidLeaveRecord } from '@/types';
import { CalendarPlus } from 'lucide-react';

interface Props {
  employeeId: string;
  employeeName: string;
  leaveRecords: PaidLeaveRecord[];
  onSaved: () => void;
}

const USAGE_TYPES = ['全日', '半日午前', '半日午後', '時間単位'] as const;

export default function PaidLeaveForm({ employeeId, employeeName, leaveRecords, onSaved }: Props) {
  const [form, setForm] = useState({
    usedDate: '',
    usageType: '全日' as typeof USAGE_TYPES[number],
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 現在有効な付与レコード（残日数あり）
  const activeRecord = leaveRecords.find((r) => r.remainingDays > 0);

  const handleSubmit = async () => {
    if (!form.usedDate) {
      setMessage({ type: 'error', text: '取得日を入力してください' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const usedDays = form.usageType === '全日' ? 1 : form.usageType === '時間単位' ? 0.125 : 0.5;
      const res = await fetch('/api/paid-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          usedDate: form.usedDate,
          usedDays,
          usageType: form.usageType,
          note: form.note,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setMessage({
          type: 'success',
          text: d.calendarGenerated
            ? `登録完了。勤怠カレンダーも自動生成しました（${d.message}）`
            : `登録完了。${d.message}`,
        });
        setForm({ usedDate: '', usageType: '全日', note: '' });
        onSaved();
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <CalendarPlus size={15} />
        有給取得を登録
      </h3>

      {/* 残日数表示 */}
      {activeRecord && (
        <div className="bg-green-50 rounded-lg px-3 py-2 mb-3 text-xs text-green-700">
          <span className="font-semibold">{employeeName}</span> の有給残日数：
          <span className="text-lg font-bold ml-1">{activeRecord.remainingDays}</span> 日
          <span className="text-gray-500 ml-2">（付与 {activeRecord.grantDays}日 ＋ 繰越 {activeRecord.carryoverDays}日 − 使用 {activeRecord.usedDays}日）</span>
        </div>
      )}

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
          <label className="block text-xs text-gray-500 mb-1">取得種別</label>
          <select
            value={form.usageType}
            onChange={(e) => setForm((f) => ({ ...f, usageType: e.target.value as typeof USAGE_TYPES[number] }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          >
            {USAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">備考</label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="任意"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !form.usedDate}
        className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {saving ? '登録中...' : '有給を登録（勤怠カレンダーも自動更新）'}
      </button>

      {message && (
        <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
