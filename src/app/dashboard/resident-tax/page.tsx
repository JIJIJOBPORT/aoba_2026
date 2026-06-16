'use client';

import { useState, useEffect } from 'react';
import { Employee } from '@/types';
import { Save } from 'lucide-react';

const MONTHS = ['06','07','08','09','10','11','12','01','02','03','04','05'];
const MONTH_LABELS: Record<string, string> = {
  '06':'6月','07':'7月','08':'8月','09':'9月','10':'10月','11':'11月',
  '12':'12月','01':'1月','02':'2月','03':'3月','04':'4月','05':'5月',
};

interface ResidentTaxRecord {
  employeeId: string;
  yearMonth: string;
  amount: number;
  status: '未払' | '支払済';
  paidDate: string;
}

export default function ResidentTaxPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<ResidentTaxRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => {
      if (d.success) { setEmployees(d.data); if (d.data[0]) setSelectedId(d.data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/resident-tax?employeeId=${selectedId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setRecords(d.data); });
  }, [selectedId]);

  // 年度が変わったら既存データをamountsにセット
  useEffect(() => {
    if (!records.length) return;
    const newAmounts: Record<string, string> = {};
    for (const mm of MONTHS) {
      const ym = getYearMonth(year, mm);
      const rec = records.find(r => r.yearMonth === ym);
      if (rec) newAmounts[mm] = String(rec.amount);
    }
    setAmounts(newAmounts);
  }, [records, year]);

  // 6月始まりの年月計算
  function getYearMonth(y: string, mm: string) {
    const monthNum = parseInt(mm);
    const yearNum = parseInt(y);
    // 6〜12月は同年、1〜5月は翌年
    const actualYear = monthNum >= 6 ? yearNum : yearNum + 1;
    return `${actualYear}-${mm}`;
  }

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    const monthsData: Record<string, number> = {};
    for (const mm of MONTHS) {
      if (amounts[mm]) monthsData[mm] = Number(amounts[mm]);
    }
    const res = await fetch('/api/resident-tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedId, year, months: monthsData }),
    });
    const d = await res.json();
    setSaving(false);
    setMessage({ type: d.success ? 'success' : 'error', text: d.message ?? d.error });
    if (d.success) {
      const res2 = await fetch(`/api/resident-tax?employeeId=${selectedId}`);
      const d2 = await res2.json();
      if (d2.success) setRecords(d2.data);
    }
  };

  const handlePaidDateChange = async (rec: ResidentTaxRecord, date: string) => {
    const newStatus = date ? '支払済' : '未払';
    await fetch('/api/resident-tax', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: rec.employeeId, yearMonth: rec.yearMonth, status: newStatus, paidDate: date }),
    });
    const res = await fetch(`/api/resident-tax?employeeId=${selectedId}`);
    const d = await res.json();
    if (d.success) setRecords(d.data);
  };

  const currentYearRecords = records
    .filter(r => {
      const mm = r.yearMonth.slice(5, 7);
      const ym_year = parseInt(r.yearMonth.slice(0, 4));
      const monthNum = parseInt(mm);
      const baseYear = parseInt(year);
      return (monthNum >= 6 && ym_year === baseYear) || (monthNum < 6 && ym_year === baseYear + 1);
    })
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">住民税管理</h1>

      {/* 社員・年度選択 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">社員</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          >
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">年度（6月始まり）</label>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}年度（{y}/6〜{y+1}/5）</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* 一括登録フォーム */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">1年分一括登録</h2>
          <p className="text-xs text-gray-400 mb-4">通知書の金額を月ごとに入力してください（空白はスキップ）</p>
          <div className="space-y-2">
            {MONTHS.map(mm => {
              const ym = getYearMonth(year, mm);
              return (
                <div key={mm} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-10">{MONTH_LABELS[mm]}</span>
                  <span className="text-xs text-gray-400 w-20">{ym}</span>
                  <input
                    type="number"
                    value={amounts[mm] ?? ''}
                    onChange={e => setAmounts(a => ({ ...a, [mm]: e.target.value }))}
                    placeholder="0"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
                  />
                  <span className="text-xs text-gray-400">円</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#34675C' }}
          >
            <Save size={14} />
            {saving ? '保存中...' : '一括保存'}
          </button>
          {message && (
            <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* 支払状況管理 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700">支払状況</h2>
          </div>
          {currentYearRecords.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              データがありません（左で登録してください）
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500">
                  <th className="text-left px-4 py-2">年月</th>
                  <th className="text-right px-3 py-2">金額</th>
                  <th className="text-center px-3 py-2">状況</th>
                  <th className="text-left px-4 py-2">支払日</th>
                </tr>
              </thead>
              <tbody>
                {currentYearRecords.map(rec => (
                  <tr key={rec.yearMonth} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{rec.yearMonth}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{rec.amount.toLocaleString()}円</td>
                    <td className="px-3 py-2 text-center">
                      {rec.status === '支払済' ? (
                        <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">支払済</span>
                      ) : (
                        <span className="text-xs text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">未払</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        defaultValue={rec.paidDate ?? ''}
                        onBlur={e => handlePaidDateChange(rec, e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#86AC41]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-4 py-2 text-xs text-gray-500" colSpan={1}>
                    未払: {currentYearRecords.filter(r => r.status === '未払').length}件
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-gray-700">
                    {currentYearRecords.reduce((s, r) => s + r.amount, 0).toLocaleString()}円
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
