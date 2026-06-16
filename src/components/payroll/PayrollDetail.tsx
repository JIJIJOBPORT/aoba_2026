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

const GREEN = '#8fbc8f';
const GREEN_DARK = '#6a9a6a';
const GREEN_LIGHT = '#e8f3e8';

export default function PayrollDetail({ employee, record, companyName = 'あおば整骨院' }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generatePayrollPdf('payroll-print-area');
      const [year, month] = record.paymentMonth.split('-');
      const monthLabel = `${year}年${parseInt(month)}月`;
      const filename = `${monthLabel}${employee.name}_給与明細.pdf`;
      downloadPdf(blob, filename);
      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('filename', filename);
      formData.append('employeeName', employee.name);
      await fetch('/api/pdf', { method: 'POST', body: formData });
    } finally {
      setExporting(false);
    }
  };

  const [year, month] = record.paymentMonth.split('-');
  const socialTotal = record.healthInsurance + record.pensionInsurance +
    record.employmentInsurance + record.longCareInsurance + record.childcareSupport;
  const taxTotal = record.incomeTax + record.residentTax;

  const fmt = (n: number) => n > 0 ? n.toLocaleString() : '';

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* PDF出力ボタン */}
      <div className="flex items-center justify-end px-4 py-3 border-b border-gray-200">
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
          style={{ backgroundColor: GREEN }}
        >
          <FileDown size={14} />
          {exporting ? '生成中...' : 'PDF出力'}
        </button>
      </div>

      {/* 印刷対象エリア */}
      <div id="payroll-print-area" className="p-6 bg-white" style={{ fontFamily: 'Arial, "Hiragino Sans", sans-serif', minWidth: 640 }}>

        {/* ヘッダー */}
        <div className="flex gap-3 mb-4">
          {/* タイトル */}
          <div
            className="flex items-center justify-center rounded-lg px-6 py-3 flex-1"
            style={{ backgroundColor: GREEN, color: 'white' }}
          >
            <span className="text-lg font-bold tracking-widest">
              {year}年&nbsp;{parseInt(month)}月&nbsp;&nbsp;給&nbsp;与&nbsp;明&nbsp;細&nbsp;書
            </span>
          </div>
          {/* 氏名・年月日 */}
          <div className="flex gap-2">
            <div className="flex flex-col">
              <div className="text-xs font-bold text-center px-4 py-1 rounded-t" style={{ backgroundColor: GREEN, color: 'white' }}>氏名</div>
              <div className="border-2 rounded-b px-4 py-2 text-sm font-medium text-center min-w-28" style={{ borderColor: GREEN }}>
                {employee.name}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-xs font-bold text-center px-4 py-1 rounded-t" style={{ backgroundColor: GREEN, color: 'white' }}>支払日</div>
              <div className="border-2 rounded-b px-4 py-2 text-sm font-medium text-center min-w-28" style={{ borderColor: GREEN }}>
                {record.paymentDate || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 支給額テーブル */}
        <SlipTable label="支給額" color={GREEN} colorLight={GREEN_LIGHT}>
          <SlipRow>
            <SlipCell label="基本給" value={fmt(record.basicSalary)} />
            <SlipCell label="時間外労働手当" value={fmt(record.overtimePay)} />
            <SlipCell label="役職手当" value={fmt(record.positionAllowance)} />
            <SlipCell label="家族手当" value={fmt(record.familyAllowance)} />
            <SlipCell label="住宅手当" value={fmt(record.housingAllowance)} />
            <SlipCell label="通勤手当" value={fmt(record.transportAllowance)} />
          </SlipRow>
          <SlipRow>
            <SlipCell label="その他手当" value={fmt(record.allowances)} />
            <SlipCell label="" value="" />
            <SlipCell label="" value="" />
            <SlipCell label="" value="" />
            <SlipCell label="" value="" />
            <SlipCell label="総支給額" value={record.grossPay.toLocaleString()} highlight color={GREEN} />
          </SlipRow>
        </SlipTable>

        <div className="my-3" />

        {/* 控除額テーブル */}
        <SlipTable label="控除額" color={GREEN} colorLight={GREEN_LIGHT}>
          <SlipRow>
            <SlipCell label="健康保険" value={fmt(record.healthInsurance)} />
            <SlipCell label="介護保険" value={fmt(record.longCareInsurance)} />
            <SlipCell label="厚生年金" value={fmt(record.pensionInsurance)} />
            <SlipCell label="雇用保険" value={fmt(record.employmentInsurance)} />
            <SlipCell label="子育て支援金" value={fmt(record.childcareSupport)} />
            <SlipCell label="社会保険合計" value={socialTotal > 0 ? socialTotal.toLocaleString() : ''} highlight color={GREEN} />
          </SlipRow>
          <SlipRow>
            <SlipCell label="所得税" value={fmt(record.incomeTax)} />
            <SlipCell label="住民税" value={fmt(record.residentTax)} />
            <SlipCell label="" value="" />
            <SlipCell label="" value="" />
            <SlipCell label="税額合計" value={taxTotal > 0 ? taxTotal.toLocaleString() : ''} highlight color={GREEN} />
            <SlipCell label="総控除額" value={record.totalDeductions.toLocaleString()} highlight color={GREEN} />
          </SlipRow>
        </SlipTable>

        <div className="my-3" />

        {/* 下段 */}
        <div className="flex gap-3">
          {/* その他・備考 */}
          <div className="flex-1 border-2 rounded-lg overflow-hidden" style={{ borderColor: GREEN }}>
            <div className="text-xs font-bold px-3 py-1" style={{ backgroundColor: GREEN, color: 'white' }}>備考</div>
            <div className="px-3 py-2 text-xs text-gray-600 min-h-12">{record.note}</div>
          </div>

          {/* 基本給単価・支払い形態 */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
              <div className="text-xs font-bold text-center px-4 py-1 rounded-t" style={{ backgroundColor: GREEN, color: 'white' }}>基本給単価</div>
              <div className="border-2 rounded-b px-4 py-2 text-sm text-center min-w-32" style={{ borderColor: GREEN }}>月給</div>
            </div>
            <div className="flex flex-col">
              <div className="text-xs font-bold text-center px-4 py-1 rounded-t" style={{ backgroundColor: GREEN, color: 'white' }}>支払い形態</div>
              <div className="border-2 rounded-b px-4 py-2 text-sm text-center min-w-32" style={{ borderColor: GREEN }}>銀行振込</div>
            </div>
          </div>

          {/* 差引支給額 */}
          <div className="flex flex-col rounded-lg overflow-hidden min-w-44" style={{ border: `2px solid ${GREEN}` }}>
            <div className="text-xs font-bold text-center py-1.5" style={{ backgroundColor: GREEN, color: 'white' }}>差引支給額</div>
            <div className="bg-white flex items-center justify-end gap-1 px-3 py-3">
              <span className="text-2xl font-bold text-gray-800">{record.netPay.toLocaleString()}</span>
              <span className="text-sm font-medium text-gray-600">円</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function SlipTable({ label, color, children }: {
  label: string;
  color: string;
  colorLight?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: color }}>
      {/* 横見出し */}
      <div className="px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: color }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SlipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex divide-x divide-green-200 border-b border-green-200 last:border-b-0">
      {children}
    </div>
  );
}

function SlipCell({ label, value, highlight, color }: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className={`flex-1 flex flex-col ${highlight ? '' : ''}`} style={{ borderColor: '#c8dfc8' }}>
      <div
        className="text-xs text-center px-1 py-0.5 border-b"
        style={{
          backgroundColor: highlight && color ? color : '#e8f3e8',
          color: highlight ? 'white' : '#444',
          borderColor: '#c8dfc8',
          fontSize: '10px',
        }}
      >
        {label || ' '}
      </div>
      <div className="text-xs text-right px-2 py-1.5 font-medium text-gray-700" style={{ minHeight: 28 }}>
        {value}
      </div>
    </div>
  );
}
