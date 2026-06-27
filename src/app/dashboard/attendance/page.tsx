'use client';

import { useState, useEffect, useCallback } from 'react';
import { Employee } from '@/types';
import type { AttendanceRecord, MonthlySummary } from '@/lib/attendance';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import PaidLeaveManager from '@/components/attendance/PaidLeaveManager';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const CATEGORY_STYLES: Record<string, string> = {
  通常: 'bg-[#f0f5f4] text-[#34675C] border-[#a8c8c0]',
  有給: 'bg-green-100 text-green-700 border-green-300',
  半休午前: 'bg-teal-100 text-teal-700 border-teal-300',
  半休午後: 'bg-teal-100 text-teal-700 border-teal-300',
  欠勤: 'bg-red-100 text-red-700 border-red-300',
  休日出勤: 'bg-orange-100 text-orange-700 border-orange-300',
  定休: 'bg-gray-100 text-gray-400 border-gray-200',
  特別休暇: 'bg-purple-100 text-purple-700 border-purple-300',
};

const CATEGORIES = ['通常', '有給', '半休午前', '半休午後', '欠勤', '休日出勤', '定休', '特別休暇'] as const;

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [yearMonth, setYearMonth] = useState(CURRENT_MONTH);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEmployees(d.data);
          if (d.data.length > 0) setSelectedId(d.data[0].id);
        }
      });
  }, []);

  const loadRecords = useCallback(async () => {
    if (!selectedId || !yearMonth) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?employeeId=${selectedId}&yearMonth=${yearMonth}`);
      const d = await res.json();
      if (d.success) {
        setRecords(d.records);
        setSummary(d.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId, yearMonth]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- API取得結果でstateを更新する通常のデータ読み込み
  useEffect(() => { loadRecords(); }, [loadRecords]);


  // 有給取得記録を勤怠カレンダーに一括反映
  const handleSyncPaidLeave = async () => {
    if (!selectedId) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/paid-leave/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedId }),
      });
      const d = await res.json();
      if (d.success) {
        setMessage({ type: 'success', text: d.message });
        await loadRecords();
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedId || !yearMonth) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedId, yearMonth }),
      });
      const d = await res.json();
      if (d.success) {
        setRecords(d.records);
        setSummary(d.summary);
        setMessage({ type: 'success', text: 'カレンダーを生成しました' });
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCategoryChange = async (
    record: AttendanceRecord,
    category: AttendanceRecord['category']
  ) => {
    setEditingDate(null);
    setSavingDate(record.date);
    setMessage(null);

    // 楽観的更新
    setRecords((prev) =>
      prev.map((r) => r.date === record.date ? { ...r, category } : r)
    );

    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedId, date: record.date, category }),
      });
      const d = await res.json();
      if (!d.success) {
        setMessage({ type: 'error', text: d.error });
        loadRecords();
      } else {
        setMessage({ type: 'success', text: `${record.date} を「${category}」で保存しました` });
        await loadRecords();
      }
    } finally {
      setSavingDate(null);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedId);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">勤怠入力</h1>

      {/* 操作バー */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">社員</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.id} {e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">対象月</label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedId}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#34675C] text-white text-sm rounded-lg hover:bg-[#2a5249] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? '生成中...' : 'カレンダー生成'}
        </button>
        <button
          onClick={handleSyncPaidLeave}
          disabled={syncing || !selectedId}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          <RotateCcw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '反映中...' : '有給を勤怠に一括反映'}
        </button>
        {message && (
          <span className={`text-sm px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* カレンダー */}
        <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-2">
              <p>データがありません</p>
              <p className="text-xs">「カレンダー生成」ボタンで自動作成できます</p>
            </div>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                  <th className="text-left px-4 py-2">日付</th>
                  <th className="text-center px-2 py-2">曜日</th>
                  <th className="text-center px-2 py-2">所定時間</th>
                  <th className="text-center px-4 py-2">区分</th>
                  <th className="text-center px-2 py-2">実労働時間</th>
                  <th className="text-left px-2 py-2">備考</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const isWeekend = rec.weekday === '日' || rec.weekday === '土';
                  return (
                    <tr
                      key={rec.date}
                      className={cn(
                        'border-b border-gray-100 hover:bg-gray-50',
                        isWeekend && 'bg-gray-50/50'
                      )}
                    >
                      <td className={cn('px-4 py-2 font-medium', rec.weekday === '日' && 'text-red-500', rec.weekday === '土' && 'text-[#7DA3A1]')}>
                        {rec.date}
                      </td>
                      <td className={cn('px-2 py-2 text-center font-medium', rec.weekday === '日' && 'text-red-500', rec.weekday === '土' && 'text-[#7DA3A1]')}>
                        {rec.weekday}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600">
                        {rec.scheduledHours > 0 ? `${rec.scheduledHours}h` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {savingDate === rec.date ? (
                          <span className="text-xs text-gray-400 animate-pulse">保存中...</span>
                        ) : editingDate === rec.date ? (
                          <select
                            autoFocus
                            defaultValue={rec.category}
                            onBlur={() => setEditingDate(null)}
                            onChange={(e) => handleCategoryChange(rec, e.target.value as AttendanceRecord['category'])}
                            className="border border-[#7DA3A1] rounded px-2 py-0.5 text-xs focus:outline-none"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingDate(rec.date)}
                            className={cn(
                              'px-2 py-0.5 rounded border text-xs cursor-pointer hover:opacity-80 transition-opacity',
                              CATEGORY_STYLES[rec.category] ?? 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {rec.category}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600">
                        {rec.actualHours > 0 ? `${rec.actualHours}h` : '—'}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">{rec.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 右パネル：月次サマリー＋有給管理 */}
        {(summary || selectedId) && (
          <div className="w-full lg:w-72 flex-shrink-0 space-y-3 overflow-y-auto">
            {/* 月次集計 */}
            {summary && <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {selectedEmployee?.name} 月次集計
              </h3>
              <div className="space-y-2 text-sm">
                <SummaryRow label="所定労働日数" value={`${summary.scheduledDays}日`} />
                <SummaryRow label="所定労働時間" value={`${summary.scheduledHours}h`} />
                <div className="border-t border-gray-100 pt-2">
                  <SummaryRow label="実労働日数" value={`${summary.workedDays}日`} color="text-[#34675C]" />
                  <SummaryRow label="実労働時間" value={`${summary.workedHours}h`} color="text-[#34675C]" />
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <SummaryRow label="有給取得" value={`${summary.paidLeaveDays}日`} color="text-green-600" />
                  <SummaryRow label="欠勤" value={`${summary.absentDays}日`} color="text-red-500" />
                  <SummaryRow label="休日出勤" value={`${summary.holidayWorkDays}日`} color="text-orange-500" />
                </div>
              </div>
            </div>}

            {/* 有給管理 */}
            {selectedEmployee && (
              <PaidLeaveManager
                employeeId={selectedId}
                employeeName={selectedEmployee.name}
                onSaved={loadRecords}
              />
            )}

            {/* 区分の凡例 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">区分（クリックで変更）</h3>
              <div className="space-y-1">
                {CATEGORIES.map((c) => (
                  <div key={c} className={cn('text-xs px-2 py-0.5 rounded border', CATEGORY_STYLES[c])}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
