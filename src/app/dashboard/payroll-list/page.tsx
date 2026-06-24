'use client';

import { useState, useEffect } from 'react';
import { Employee, PayrollRecord } from '@/types';
import { X, Pencil, Check, Trash2 } from 'lucide-react';
import PayrollDetail from '@/components/payroll/PayrollDetail';

export default function PayrollListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState<'' | '給与' | '賞与'>('');
  const [loading, setLoading] = useState(false);
  const [modalRecord, setModalRecord] = useState<PayrollRecord | null>(null);
  const [editingAtt, setEditingAtt] = useState(false);
  const [attForm, setAttForm] = useState({ workDays: 0, paidLeaveDays: 0, absentDays: 0, workHours: 0, overtimeHours: 0, note: '' });
  const [attSaving, setAttSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => d.success && setEmployees(d.data));
  }, []);

  useEffect(() => {
    if (!selectedEmployee) return;
    setLoading(true);
    fetch(`/api/payroll?employeeId=${selectedEmployee.id}`)
      .then((r) => r.json())
      .then((d) => d.success && setPayrolls(d.data))
      .finally(() => setLoading(false));
  }, [selectedEmployee]);

  const handleDelete = async (rec: typeof payrolls[number]) => {
    if (!confirm(`${rec.paymentMonth} の給与データを削除しますか？\nこの操作は取り消せません。`)) return;
    setDeletingId(rec.id);
    try {
      const res = await fetch('/api/payroll/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id }),
      });
      const d = await res.json();
      if (d.success) {
        setPayrolls((ps) => ps.filter((p) => p.id !== rec.id));
        if (modalRecord?.id === rec.id) setModalRecord(null);
      } else {
        alert(`削除エラー: ${d.error}`);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = payrolls.filter((p) => {
    if (filterMonth && !p.paymentMonth.startsWith(filterMonth)) return false;
    if (filterType && p.recordType !== filterType) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">給与明細一覧</h1>

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">社員</label>
          <select
            value={selectedEmployee?.id ?? ''}
            onChange={(e) => {
              const emp = employees.find((em) => em.id === e.target.value) ?? null;
              setSelectedEmployee(emp);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          >
            <option value="">社員を選択</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.id} {e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">年月で絞り込み</label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">区分</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as '' | '給与' | '賞与')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          >
            <option value="">すべて</option>
            <option value="給与">給与</option>
            <option value="賞与">賞与</option>
          </select>
        </div>
        {(filterMonth || filterType) && (
          <button
            onClick={() => { setFilterMonth(''); setFilterType(''); }}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            絞り込みを解除
          </button>
        )}
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">読み込み中...</div>
        ) : !selectedEmployee ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">社員を選択してください</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">データがありません</div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left px-4 py-3">支給月</th>
                <th className="text-center px-3 py-3">区分</th>
                <th className="text-right px-3 py-3">基本給</th>
                <th className="text-right px-3 py-3">総支給額</th>
                <th className="text-right px-3 py-3">控除合計</th>
                <th className="text-right px-4 py-3">差引支給額</th>
                <th className="text-center px-3 py-3">明細</th>
                <th className="text-center px-3 py-3">削除</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-700">{rec.paymentMonth}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rec.recordType === '賞与' ? 'bg-yellow-100 text-yellow-700' : 'bg-[#e8f0ef] text-[#34675C]'}`}>
                      {rec.recordType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600">{rec.basicSalary.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-gray-600">{rec.grossPay.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-[#b85c58]">{rec.totalDeductions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{rec.netPay.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => {
                        setModalRecord(rec);
                        setEditingAtt(false);
                        setAttForm({ workDays: rec.workDays, paidLeaveDays: rec.paidLeaveDays, absentDays: rec.absentDays, workHours: rec.workHours, overtimeHours: rec.overtimeHours, note: rec.note });
                      }}
                      className="text-xs text-[#34675C] border border-[#7DA3A1] px-3 py-1 rounded hover:bg-[#f0f5f4] transition-colors"
                    >
                      明細表示
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleDelete(rec)}
                      disabled={deletingId === rec.id}
                      className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deletingId === rec.id ? '削除中...' : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300 text-sm font-semibold">
                <td className="px-4 py-2 text-gray-600" colSpan={3}>合計 {filtered.length}件</td>

                <td className="px-3 py-2 text-right text-gray-700">
                  {filtered.reduce((s, r) => s + r.grossPay, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-[#b85c58]">
                  {filtered.reduce((s, r) => s + r.totalDeductions, 0).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-[#34675C]">
                  {filtered.reduce((s, r) => s + r.netPay, 0).toLocaleString()}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 明細モーダル */}
      {modalRecord && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">
                {selectedEmployee.name}｜{modalRecord.paymentMonth} 給与明細
              </h2>
              <button
                onClick={() => setModalRecord(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            {/* 勤怠手修正パネル */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">勤怠情報（手修正）</span>
                {!editingAtt ? (
                  <button onClick={() => setEditingAtt(true)} className="flex items-center gap-1 text-xs text-[#34675C] border border-[#7DA3A1] px-2 py-1 rounded hover:bg-[#f0f5f5]">
                    <Pencil size={11} />修正
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingAtt(false)} className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-200">キャンセル</button>
                    <button
                      disabled={attSaving}
                      onClick={async () => {
                        setAttSaving(true);
                        const res = await fetch('/api/payroll/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: modalRecord.id, ...attForm }) });
                        const d = await res.json();
                        if (d.success) {
                          setModalRecord({ ...modalRecord, ...attForm });
                          setPayrolls(ps => ps.map(p => p.id === modalRecord.id ? { ...p, ...attForm } : p));
                          setEditingAtt(false);
                        }
                        setAttSaving(false);
                      }}
                      className="flex items-center gap-1 text-xs text-white px-3 py-1 rounded"
                      style={{ backgroundColor: '#34675C' }}
                    >
                      <Check size={11} />{attSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                {[
                  { label: '出勤日数', key: 'workDays' as const },
                  { label: '有給日数', key: 'paidLeaveDays' as const },
                  { label: '欠勤日数', key: 'absentDays' as const },
                  { label: '勤務時間', key: 'workHours' as const },
                  { label: '残業時間', key: 'overtimeHours' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <div className="text-gray-400 mb-1">{label}</div>
                    {editingAtt ? (
                      <input type="number" value={attForm[key]} onChange={e => setAttForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#86AC41]" />
                    ) : (
                      <div className="font-medium text-gray-700">{modalRecord[key]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 sm:p-5 overflow-x-auto">
              <PayrollDetail employee={selectedEmployee} record={modalRecord} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
