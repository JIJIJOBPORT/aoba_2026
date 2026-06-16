'use client';

import { useState, useEffect } from 'react';
import { Employee, PayrollRecord } from '@/types';
import { X } from 'lucide-react';
import PayrollDetail from '@/components/payroll/PayrollDetail';

export default function PayrollListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState<'' | '給与' | '賞与'>('');
  const [loading, setLoading] = useState(false);
  const [modalRecord, setModalRecord] = useState<PayrollRecord | null>(null);

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

  const filtered = payrolls.filter((p) => {
    if (filterMonth && !p.paymentMonth.startsWith(filterMonth)) return false;
    if (filterType && p.recordType !== filterType) return false;
    return true;
  });

  return (
    <div className="p-6">
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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">読み込み中...</div>
        ) : !selectedEmployee ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">社員を選択してください</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">データがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left px-4 py-3">支給月</th>
                <th className="text-center px-3 py-3">区分</th>
                <th className="text-right px-3 py-3">基本給</th>
                <th className="text-right px-3 py-3">総支給額</th>
                <th className="text-right px-3 py-3">控除合計</th>
                <th className="text-right px-4 py-3">差引支給額</th>
                <th className="text-center px-3 py-3">明細</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-700">{rec.paymentMonth}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rec.recordType === '賞与' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {rec.recordType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600">{rec.basicSalary.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-gray-600">{rec.grossPay.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-red-500">{rec.totalDeductions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{rec.netPay.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => setModalRecord(rec)}
                      className="text-xs text-[#34675C] border border-[#7DA3A1] px-3 py-1 rounded hover:bg-[#f0f5f5] transition-colors"
                    >
                      明細表示
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
                <td className="px-3 py-2 text-right text-red-500">
                  {filtered.reduce((s, r) => s + r.totalDeductions, 0).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-blue-700">
                  {filtered.reduce((s, r) => s + r.netPay, 0).toLocaleString()}
                </td>
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
            <div className="p-5">
              <PayrollDetail employee={selectedEmployee} record={modalRecord} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
