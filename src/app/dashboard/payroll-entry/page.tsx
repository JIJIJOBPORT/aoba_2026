'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Employee, PayrollRecord } from '@/types';
import { Calculator, Save, Upload, Copy } from 'lucide-react';
import Papa from 'papaparse';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const emptyForm = {
  employeeId: '',
  paymentMonth: CURRENT_MONTH,
  paymentDate: '',
  recordType: '給与' as PayrollRecord['recordType'],
  workDays: 0,
  paidLeaveDays: 0,
  absentDays: 0,
  workHours: 0,
  overtimeHours: 0,
  basicSalary: 0,
  positionAllowance: 0,
  familyAllowance: 0,
  housingAllowance: 0,
  allowances: 0,
  overtimePay: 0,
  transportAllowance: 0,
  residentTax: 0,
  note: '',
};

export default function PayrollEntryPage() {
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [calculated, setCalculated] = useState<{
    grossPay: number;
    healthInsurance: number;
    pensionInsurance: number;
    employmentInsurance: number;
    longCareInsurance: number;
    childcareSupport: number;
    incomeTax: number;
    totalDeductions: number;
    netPay: number;
  } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CSV取込
  const [csvMonth, setCsvMonth] = useState(CURRENT_MONTH);
  const [csvResult, setCsvResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEmployees(d.data);
          const idFromUrl = searchParams.get('employeeId');
          if (idFromUrl) setForm((f) => ({ ...f, employeeId: idFromUrl }));
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEmployee = employees.find((e) => e.id === form.employeeId);

  // 住民税を自動取得（社員または勤務月が変わったとき）
  useEffect(() => {
    if (!form.employeeId || !form.paymentMonth) return;
    const [y, m] = form.paymentMonth.split('-').map(Number);
    const paymentYearMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    fetch(`/api/resident-tax?employeeId=${form.employeeId}&yearMonth=${paymentYearMonth}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.length > 0) {
          setForm((f) => ({ ...f, residentTax: d.data[0].amount }));
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.employeeId, form.paymentMonth]);

  // 勤務月が変わったら支払日を翌月25日に自動セット
  const handleWorkMonthChange = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    const paymentDate = `${nextMonth}-25`;
    setForm((f) => ({ ...f, paymentMonth: yearMonth, paymentDate }));
    setCalculated(null);
  };

  // 前月コピー
  const handleCopyPrevMonth = async () => {
    if (!form.employeeId || !form.paymentMonth) return;
    setCopying(true); setMessage(null);
    const res = await fetch(`/api/payroll/previous-month?employeeId=${form.employeeId}&paymentMonth=${form.paymentMonth}`);
    const d = await res.json();
    setCopying(false);
    if (d.success) {
      setForm((f) => ({ ...f, ...d.data }));
      setCalculated(null);
      setMessage({ type: 'success', text: '前月のデータをコピーしました' });
    } else {
      setMessage({ type: 'error', text: d.error });
    }
  };

  const handleCalculate = useCallback(async () => {
    if (!selectedEmployee || !form.paymentMonth) return;
    setCalculating(true);
    setMessage(null);

    const grossPay = form.basicSalary + form.positionAllowance + form.familyAllowance +
      form.housingAllowance + form.allowances + form.overtimePay + form.transportAllowance;

    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossPay,
          paymentMonth: form.paymentMonth,
          dependents: selectedEmployee.dependents,
          birthDate: selectedEmployee.birthDate,
          residentTax: form.residentTax,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setCalculated({
          grossPay,
          ...d.data,
          netPay: grossPay - d.data.totalDeductions,
        });
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setCalculating(false);
    }
  }, [form, selectedEmployee]);

  const handleSave = async () => {
    if (!selectedEmployee) {
      setMessage({ type: 'error', text: '社員を選択してください' });
      return;
    }
    if (!calculated) {
      setMessage({ type: 'error', text: '先に「自動計算」を実行してください' });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      // 勤怠データを自動取得
      let workDays = 0, paidLeaveDays = 0, absentDays = 0, workHours = 0, overtimeHours = 0;
      const attRes = await fetch(`/api/attendance?employeeId=${form.employeeId}&yearMonth=${form.paymentMonth}`);
      const attData = await attRes.json();
      if (attData.success && attData.summary) {
        workDays = attData.summary.workedDays ?? 0;
        paidLeaveDays = attData.summary.paidLeaveDays ?? 0;
        absentDays = attData.summary.absentDays ?? 0;
        workHours = attData.summary.workedHours ?? 0;
        overtimeHours = 0;
      }

      const res = await fetch('/api/payroll/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId,
          paymentMonth: form.paymentMonth,
          paymentDate: form.paymentDate,
          recordType: form.recordType,
          workDays,
          paidLeaveDays,
          absentDays,
          workHours,
          overtimeHours,
          basicSalary: form.basicSalary,
          positionAllowance: form.positionAllowance,
          familyAllowance: form.familyAllowance,
          housingAllowance: form.housingAllowance,
          allowances: form.allowances,
          overtimePay: form.overtimePay,
          transportAllowance: form.transportAllowance,
          grossPay: calculated.grossPay,
          healthInsurance: calculated.healthInsurance,
          pensionInsurance: calculated.pensionInsurance,
          employmentInsurance: calculated.employmentInsurance,
          longCareInsurance: calculated.longCareInsurance,
          childcareSupport: calculated.childcareSupport,
          incomeTax: calculated.incomeTax,
          residentTax: form.residentTax,
          totalDeductions: calculated.totalDeductions,
          netPay: calculated.netPay,
          note: form.note,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setMessage({ type: 'success', text: '給与データを保存しました' });
        setForm({ ...emptyForm, paymentMonth: form.paymentMonth });
        setCalculated(null);
      } else {
        setMessage({ type: 'error', text: d.error });
      }
    } finally {
      setSaving(false);
    }
  };

  // 給与データ一括取込
  const [bulkCsvResult, setBulkCsvResult] = useState<string | null>(null);
  const [bulkCsvErrors, setBulkCsvErrors] = useState<string[]>([]);

  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        setBulkCsvResult(null);
        setBulkCsvErrors([]);
        const res = await fetch('/api/payroll/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: result.data }),
        });
        const d = await res.json();
        if (d.success) {
          setBulkCsvResult(d.message);
          setBulkCsvErrors(d.errors ?? []);
        } else {
          setBulkCsvResult(`エラー: ${d.error}`);
        }
      },
    });
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const header = '社員ID,勤務月,支払日,区分,基本給,役職手当,家族手当,住宅手当,その他手当,時間外手当,交通費,健康保険,厚生年金,雇用保険,介護保険,子育て支援金,所得税,住民税,備考';
    const sample = 'nagai,2026-04,2026-05-25,給与,300000,0,0,0,0,0,0,15180,27450,1499,2430,345,4590,4900,';
    const blob = new Blob([header + '\n' + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '給与データ取込テンプレート.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 社会保険料CSV取込（給与明細の更新）
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const res = await fetch('/api/csv-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: result.data, paymentMonth: csvMonth }),
        });
        const d = await res.json();
        setCsvResult(d.message ?? d.error);
      },
    });
    e.target.value = '';
  };

  // 源泉所得税マスタCSV取込
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [taxCsvResult, setTaxCsvResult] = useState<string | null>(null);
  const [taxOverwrite, setTaxOverwrite] = useState(true);

  const handleTaxCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const res = await fetch('/api/csv-import/withholding-tax', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: result.data, year: taxYear, overwrite: taxOverwrite }),
        });
        const d = await res.json();
        setTaxCsvResult(d.message ?? d.error);
      },
    });
    e.target.value = '';
  };

  const numField = (key: keyof typeof emptyForm) => ({
    type: 'number',
    value: form[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: Number(e.target.value) })),
    className: 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]',
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">給与情報登録</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* 左：入力フォーム */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">支給情報入力</h2>

          {/* 社員選択 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">社員</label>
            <select
              value={form.employeeId}
              onChange={(e) => { setForm((f) => ({ ...f, employeeId: e.target.value })); setCalculated(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
            >
              <option value="">社員を選択してください</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} {e.name}
                </option>
              ))}
            </select>
          </div>

          {/* 勤務月・支払日 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                勤務月
                <span className="ml-1 text-gray-400">（支払は翌月25日）</span>
              </label>
              <input
                type="month"
                value={form.paymentMonth}
                onChange={(e) => handleWorkMonthChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                支払日
                <span className="ml-1 text-gray-400">（自動設定）</span>
              </label>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">区分</label>
            <select
              value={form.recordType}
              onChange={(e) => setForm((f) => ({ ...f, recordType: e.target.value as PayrollRecord['recordType'] }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
            >
              <option value="給与">給与</option>
              <option value="賞与">賞与</option>
            </select>
          </div>

          {/* 勤怠：自動取得 */}
          <div className="border-t border-gray-100 pt-3 mb-4">
            <p className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
              勤怠情報（出勤日数・時間・有給）は保存時に勤怠データから自動取得します
            </p>
          </div>

          {/* 支給項目 */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">【支給】</p>
            <div className="space-y-2">
              <Row label="基本給"><input {...numField('basicSalary')} /></Row>
              <Row label="役職手当"><input {...numField('positionAllowance')} /></Row>
              <Row label="家族手当"><input {...numField('familyAllowance')} /></Row>
              <Row label="住宅手当"><input {...numField('housingAllowance')} /></Row>
              <Row label="その他手当"><input {...numField('allowances')} /></Row>
              <Row label="時間外手当"><input {...numField('overtimePay')} /></Row>
              <Row label="交通費"><input {...numField('transportAllowance')} /></Row>
            </div>
          </div>

          {/* 住民税（手入力）*/}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">【手入力控除】</p>
            <Row label="住民税"><input {...numField('residentTax')} /></Row>
          </div>

          {/* 備考 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">備考</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
            />
          </div>

          {/* ボタン */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyPrevMonth}
              disabled={!form.employeeId || copying}
              className="flex items-center gap-1.5 px-4 py-2 border border-[#7DA3A1] text-[#34675C] text-sm rounded-lg hover:bg-[#f0f5f5] disabled:opacity-50 transition-colors"
            >
              <Copy size={14} />
              {copying ? 'コピー中...' : '前月コピー'}
            </button>
            <button
              onClick={handleCalculate}
              disabled={!form.employeeId || calculating}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#34675C] text-white text-sm rounded-lg hover:bg-[#2a5249] disabled:opacity-50 transition-colors"
            >
              <Calculator size={14} />
              {calculating ? '計算中...' : '自動計算'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#86AC41] text-white text-sm rounded-lg hover:bg-[#6d9235] disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          {message && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* 右：計算結果プレビュー */}
        <div className="space-y-4">
          {calculated ? (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">計算結果プレビュー</h2>

              {selectedEmployee && (
                <p className="text-sm text-gray-600 mb-3">
                  {selectedEmployee.name}（扶養 {selectedEmployee.dependents}人）
                </p>
              )}

              <div className="space-y-1 mb-3">
                <SummaryRow label="総支給額" value={calculated.grossPay} className="font-semibold text-gray-800" />
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-1 mb-3">
                <p className="text-xs font-semibold text-red-500 mb-1">控除</p>
                <SummaryRow label="健康保険料" value={calculated.healthInsurance} />
                <SummaryRow label="厚生年金保険料" value={calculated.pensionInsurance} />
                <SummaryRow label="雇用保険料" value={calculated.employmentInsurance} />
                {calculated.longCareInsurance > 0 && (
                  <SummaryRow label="介護保険料" value={calculated.longCareInsurance} />
                )}
                {calculated.childcareSupport > 0 && (
                  <SummaryRow label="子ども・子育て支援金" value={calculated.childcareSupport} />
                )}
                <SummaryRow label="所得税" value={calculated.incomeTax} />
                <SummaryRow label="住民税" value={form.residentTax} />
                <div className="border-t border-gray-100 pt-1">
                  <SummaryRow label="控除合計" value={calculated.totalDeductions} className="text-red-600 font-semibold" />
                </div>
              </div>

              <div className="bg-[#86AC41] text-white rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-semibold">差引支給額</span>
                <span className="text-xl font-bold">{calculated.netPay.toLocaleString()}円</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
              社員と支給情報を入力して<br />「自動計算」を押してください
            </div>
          )}

          {/* ① 給与データ一括取込 */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              ① 過去給与データ 一括取込
            </h2>
            <p className="text-xs text-gray-500 mb-1">
              CSVで過去の給与データをまとめて取込みます。総支給額・控除合計・差引支給額は自動計算されます。
            </p>
            <p className="text-xs text-gray-400 mb-3">
              必須列: <code className="bg-gray-100 px-1 rounded">社員ID, 勤務月, 支払日, 区分, 基本給, 役職手当, 家族手当, 住宅手当, その他手当, 時間外手当, 交通費, 健康保険, 厚生年金, 雇用保険, 介護保険, 子育て支援金, 所得税, 住民税, 備考</code>
            </p>
            <div className="flex gap-3 items-center flex-wrap mb-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">CSVファイル</label>
                <input type="file" accept=".csv" onChange={handleBulkCsvUpload} className="text-sm text-gray-600" />
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="text-xs text-[#34675C] underline hover:text-[#2a5249] mt-4"
              >
                テンプレートCSVをダウンロード
              </button>
            </div>
            {bulkCsvResult && (
              <div className={`mt-2 text-sm rounded px-3 py-2 ${bulkCsvResult.startsWith('エラー') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {bulkCsvResult}
                {bulkCsvErrors.length > 0 && (
                  <ul className="mt-1 text-xs list-disc list-inside">
                    {bulkCsvErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* ③ 社会保険料・住民税CSV取込 */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              ② 社会保険料・住民税 CSV取込
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              既存の給与明細レコードの保険料・税額を一括更新します。<br />
              必須列: <code className="bg-gray-100 px-1 rounded">社員ID, 区分, 健康保険料, 厚生年金保険料, 雇用保険料, 介護保険料, 子ども・子育て支援金, 所得税, 住民税</code>
            </p>
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">対象月</label>
                <input
                  type="month"
                  value={csvMonth}
                  onChange={(e) => setCsvMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CSVファイル</label>
                <input type="file" accept=".csv" onChange={handleCsvUpload} className="text-sm text-gray-600" />
              </div>
            </div>
            {csvResult && (
              <p className="mt-2 text-sm text-[#34675C] bg-[#f0f5f4] rounded px-3 py-2">{csvResult}</p>
            )}
          </div>

          {/* ③ 源泉所得税マスタCSV取込 */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              ③ 源泉所得税マスタ CSV取込
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              国税庁の月額表をCSVで登録します。<br />
              必須列: <code className="bg-gray-100 px-1 rounded">以上, 未満, 扶養0人, 扶養1人, 扶養2人, 扶養3人, 扶養4人, 扶養5人, 扶養6人, 扶養7人以上</code>
            </p>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-1">適用年度</label>
                <input
                  type="number"
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="overwrite"
                  checked={taxOverwrite}
                  onChange={(e) => setTaxOverwrite(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="overwrite" className="text-xs text-gray-600">既存データを上書き</label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CSVファイル</label>
                <input type="file" accept=".csv" onChange={handleTaxCsvUpload} className="text-sm text-gray-600" />
              </div>
            </div>
            {taxCsvResult && (
              <p className="mt-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">{taxCsvResult}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-24 text-xs text-gray-500 flex-shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, className = 'text-gray-700' }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between text-sm ${className}`}>
      <span>{label}</span>
      <span>{value.toLocaleString()}円</span>
    </div>
  );
}
