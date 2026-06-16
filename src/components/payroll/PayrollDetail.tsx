'use client';

import { useState } from 'react';
import { Employee, PayrollRecord } from '@/types';
import { FileDown } from 'lucide-react';
import { generatePayrollPdf, downloadPdf } from '@/lib/pdf';

interface Props {
  employee: Employee;
  record: PayrollRecord;
  companyName?: string;
}

export default function PayrollDetail({ employee, record, companyName = 'あおば整骨院' }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generatePayrollPdf('payroll-print-area');
      const filename = `給与明細_${employee.name}_${record.paymentMonth}.pdf`;
      downloadPdf(blob, filename);
      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('filename', filename);
      await fetch('/api/pdf', { method: 'POST', body: formData });
    } finally {
      setExporting(false);
    }
  };

  const taxableGross = record.grossPay - record.transportAllowance;
  const socialTotal = record.healthInsurance + record.pensionInsurance +
    record.employmentInsurance + record.longCareInsurance + record.childcareSupport;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">給与明細プレビュー</h3>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <FileDown size={14} />
          {exporting ? '生成中...' : 'PDF出力'}
        </button>
      </div>

      {/* 印刷対象エリア */}
      <div id="payroll-print-area" className="p-4 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>

        {/* ヘッダー */}
        <div className="border-2 border-gray-700 mb-3">
          <div className="grid grid-cols-3 border-b border-gray-700">
            <div className="text-center py-2 border-r border-gray-700 bg-gray-100 font-bold text-xs">給与支給明細書</div>
            <div className="text-center py-2 border-r border-gray-700 bg-gray-100 font-bold text-xs">所属</div>
            <div className="text-center py-2 bg-gray-100 font-bold text-xs">氏名</div>
          </div>
          <div className="grid grid-cols-3">
            <div className="text-center py-2 border-r border-gray-700 text-xs font-medium">
              {record.paymentMonth.replace('-', '年').replace(/(\d{2})$/, '$1月')}
            </div>
            <div className="text-center py-2 border-r border-gray-700 text-xs">{companyName}</div>
            <div className="text-center py-2 text-xs font-medium">{employee.name}</div>
          </div>
        </div>

        {/* 支払日 */}
        <p className="text-xs text-gray-600 mb-2">
          支払日: <span className="font-medium">{record.paymentDate || '—'}</span>
        </p>

        {/* 勤怠 */}
        <Section title="勤怠" color="bg-slate-600">
          <GridRow
            items={[
              { label: '出勤日数', value: `${record.workDays}日` },
              { label: '休日出勤', value: `${record.overtimeHours > 0 ? 1 : 0}日` },
              { label: '欠勤日数', value: `${record.absentDays}日` },
              { label: '遅刻・早退', value: '0' },
              { label: '有給休暇', value: `${record.paidLeaveDays}日` },
            ]}
          />
          <GridRow
            items={[
              { label: '勤務時間', value: `${record.workHours}h` },
              { label: '普通残業', value: `${record.overtimeHours}h` },
              { label: '深夜残業', value: '0' },
              { label: '休日深夜', value: '0' },
              { label: '', value: '' },
            ]}
          />
        </Section>

        {/* 支給 */}
        <Section title="支給" color="bg-blue-600">
          <GridRow
            items={[
              { label: '基本給', value: record.basicSalary.toLocaleString() },
              { label: '役職手当', value: record.positionAllowance.toLocaleString() },
              { label: '家族手当', value: record.familyAllowance.toLocaleString() },
              { label: '住宅手当', value: record.housingAllowance.toLocaleString() },
              { label: 'その他手当', value: record.allowances.toLocaleString() },
            ]}
          />
          <GridRow
            items={[
              { label: '時間外手当', value: record.overtimePay.toLocaleString() },
              { label: '交通費', value: record.transportAllowance.toLocaleString() },
              { label: '課税支給額', value: taxableGross.toLocaleString() },
              { label: '非課税支給額', value: record.transportAllowance.toLocaleString() },
              { label: '総支給額', value: record.grossPay.toLocaleString(), highlight: true },
            ]}
          />
        </Section>

        {/* 控除 */}
        <Section title="控除" color="bg-red-500">
          <GridRow
            items={[
              { label: '健康保険料', value: record.healthInsurance.toLocaleString() },
              { label: '厚生年金保険料', value: record.pensionInsurance.toLocaleString() },
              { label: '子ども・子育て支援金', value: record.childcareSupport.toLocaleString() },
              { label: '雇用保険料', value: record.employmentInsurance.toLocaleString() },
              { label: '社会保険料合計', value: socialTotal.toLocaleString(), highlight: true },
            ]}
          />
          {record.longCareInsurance > 0 && (
            <GridRow
              items={[
                { label: '介護保険料', value: record.longCareInsurance.toLocaleString() },
                { label: '', value: '' },
                { label: '', value: '' },
                { label: '', value: '' },
                { label: '', value: '' },
              ]}
            />
          )}
          <GridRow
            items={[
              { label: '所得税', value: record.incomeTax.toLocaleString() },
              { label: '住民税', value: record.residentTax.toLocaleString() },
              { label: '', value: '' },
              { label: '控除合計', value: record.totalDeductions.toLocaleString(), highlight: true },
              { label: '差引支給額', value: record.netPay.toLocaleString(), highlight: true },
            ]}
          />
        </Section>

        {/* 備考 */}
        <div className="border border-gray-300 mt-1">
          <div className="bg-slate-600 text-white text-xs font-bold px-3 py-1">備考</div>
          <div className="px-3 py-2 text-xs text-gray-600 min-h-8">{record.note}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-300 mb-1">
      <div className={`${color} text-white text-xs font-bold px-3 py-1`}>{title}</div>
      {children}
    </div>
  );
}

function GridRow({ items }: { items: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="grid border-b border-gray-200 last:border-0" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((item, i) => (
        <div key={i} className={`border-r border-gray-200 last:border-0 ${item.highlight ? 'bg-gray-50' : ''}`}>
          <div className="text-center text-xs text-gray-500 bg-gray-50 border-b border-gray-200 px-1 py-0.5 leading-tight">
            {item.label}
          </div>
          <div className={`text-center text-xs px-1 py-1 font-medium ${item.highlight ? 'text-gray-800 font-bold' : 'text-gray-700'}`}>
            {item.value || '0'}
          </div>
        </div>
      ))}
    </div>
  );
}
