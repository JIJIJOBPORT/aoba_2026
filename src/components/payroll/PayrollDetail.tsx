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

const G = '#34675C';       // メイングリーン
const GL = '#e8f0ef';      // 薄いグリーン（ヘッダー背景）
const BD = '#a8c8c0';      // ボーダー色

export default function PayrollDetail({ employee, record, companyName = 'あおば整骨院' }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await generatePayrollPdf('payroll-print-area');
      const [year, month] = record.paymentMonth.split('-');
      const filename = `${year}年${parseInt(month)}月${employee.name}_給与明細.pdf`;
      downloadPdf(blob, filename);
      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('filename', filename);
      formData.append('employeeName', employee.name);
      formData.append('payrollId', record.id);
      const driveRes = await fetch('/api/pdf', { method: 'POST', body: formData });
      const driveData = await driveRes.json();
      if (!driveData.success) {
        setExportError(`Drive保存エラー: ${driveData.error}`);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const [year, month] = record.paymentMonth.split('-');
  const socialTotal = record.healthInsurance + record.pensionInsurance +
    record.employmentInsurance + record.longCareInsurance + record.childcareSupport;
  const taxableBase = record.grossPay - record.transportAllowance;
  const fmt = (n: number) => n > 0 ? n.toLocaleString() : '';
  const fmtN = (n: number) => n.toLocaleString(); // 0も表示（勤怠欄用）

  const td: React.CSSProperties = {
    border: `1px solid ${BD}`,
    padding: '2px 6px',
    fontSize: 11,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  };
  const th: React.CSSProperties = {
    border: `1px solid ${BD}`,
    padding: '2px 4px',
    fontSize: 10,
    textAlign: 'center',
    backgroundColor: GL,
    color: '#333',
    fontWeight: 'bold',
  };
  const section: React.CSSProperties = {
    border: `1px solid ${BD}`,
    padding: '2px 4px',
    fontSize: 11,
    textAlign: 'center',
    backgroundColor: G,
    color: 'white',
    fontWeight: 'bold',
    writingMode: 'vertical-rl' as const,
    letterSpacing: 4,
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      {/* PDF出力ボタン */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        {exportError && (
          <span style={{ fontSize: 12, color: '#dc2626', backgroundColor: '#fef2f2', padding: '4px 12px', borderRadius: 8 }}>{exportError}</span>
        )}
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', backgroundColor: G, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: exporting ? 0.5 : 1 }}
        >
          <FileDown size={14} />
          {exporting ? '生成中...' : 'PDF出力'}
        </button>
      </div>

      {/* 印刷対象エリア */}
      <div id="payroll-print-area" style={{ padding: 24, backgroundColor: 'white', fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif', minWidth: 640 }}>

        {/* タイトル行 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ ...th, width: '30%', fontSize: 13, padding: '4px 8px' }}>給与支給明細書</td>
              <td style={{ ...th, width: '30%', fontSize: 13, padding: '4px 8px' }}>所属</td>
              <td style={{ ...th, width: '40%', fontSize: 13, padding: '4px 8px' }}>氏名</td>
            </tr>
            <tr>
              <td style={{ ...td, textAlign: 'center', fontWeight: 'bold' }}>{year}年{parseInt(month)}月</td>
              <td style={{ ...td, textAlign: 'center' }}>{companyName}</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>{employee.name}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: 11, marginBottom: 10, color: '#444' }}>支給日{record.paymentDate || '—'}</div>

        {/* メイン明細テーブル */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {/* 勤怠ヘッダー */}
            <tr>
              <td rowSpan={4} style={{ ...section, width: 28 }}>勤怠</td>
              <td style={th}>出勤日数</td>
              <td style={th}>休日出勤</td>
              <td style={th}>欠勤日数</td>
              <td style={th}>遅刻早退</td>
              <td style={th}>有給休暇</td>
              <td style={th}></td>
            </tr>
            <tr>
              <td style={td}>{fmtN(record.workDays)}</td>
              <td style={td}></td>
              <td style={td}>{fmtN(record.absentDays)}</td>
              <td style={td}></td>
              <td style={td}>{fmtN(record.paidLeaveDays)}</td>
              <td style={td}></td>
            </tr>
            <tr>
              <td style={th}>勤務時間</td>
              <td style={th}>普通残業</td>
              <td style={th}>深夜残業</td>
              <td style={th}>休日深夜</td>
              <td style={th}></td>
              <td style={th}></td>
            </tr>
            <tr>
              <td style={td}>{fmtN(record.workHours)}</td>
              <td style={td}>{fmtN(record.overtimeHours)}</td>
              <td style={td}></td>
              <td style={td}></td>
              <td style={td}></td>
              <td style={td}></td>
            </tr>

            {/* 支給ヘッダー */}
            <tr>
              <td rowSpan={4} style={{ ...section }}>支給</td>
              <td style={th}>基本給</td>
              <td style={th}>役職手当</td>
              <td style={th}>家族手当</td>
              <td style={th}>住宅手当</td>
              <td style={th}></td>
              <td style={th}></td>
            </tr>
            <tr>
              <td style={td}>{fmt(record.basicSalary)}</td>
              <td style={td}>{fmt(record.positionAllowance)}</td>
              <td style={td}>{fmt(record.familyAllowance)}</td>
              <td style={td}>{fmt(record.housingAllowance)}</td>
              <td style={td}></td>
              <td style={td}></td>
            </tr>
            <tr>
              <td style={th}>時間外手当</td>
              <td style={th}>その他手当</td>
              <td style={th}>課税支給額</td>
              <td style={th}>交通費</td>
              <td style={th}>非課税支給額</td>
              <td style={{ ...th, backgroundColor: GL, color: G, fontWeight: 'bold' }}>総支給額</td>
            </tr>
            <tr>
              <td style={td}>{fmt(record.overtimePay)}</td>
              <td style={td}>{fmt(record.allowances)}</td>
              <td style={td}>{fmt(taxableBase)}</td>
              <td style={td}>{fmt(record.transportAllowance)}</td>
              <td style={td}>{fmt(record.transportAllowance)}</td>
              <td style={{ ...td, fontWeight: 'bold', backgroundColor: GL, color: G }}>{record.grossPay.toLocaleString()}</td>
            </tr>

            {/* 控除ヘッダー */}
            <tr>
              <td rowSpan={4} style={{ ...section }}>控除</td>
              <td style={th}>健康保険料</td>
              <td style={th}>厚生年金保険料</td>
              <td style={th}>雇用保険料</td>
              <td style={th}>社会保険合計</td>
              <td style={th}>課税対象</td>
              <td style={th}></td>
            </tr>
            <tr>
              <td style={td}>{fmt(record.healthInsurance + record.longCareInsurance)}</td>
              <td style={td}>{fmt(record.pensionInsurance)}</td>
              <td style={td}>{fmt(record.employmentInsurance)}</td>
              <td style={td}>{fmt(socialTotal)}</td>
              <td style={td}>{fmt(taxableBase - socialTotal)}</td>
              <td style={td}></td>
            </tr>
            <tr>
              <td style={th}>所得税</td>
              <td style={th}>住民税</td>
              <td style={th}></td>
              <td style={th}></td>
              <td style={{ ...th, backgroundColor: GL, color: G, fontWeight: 'bold' }}>控除合計</td>
              <td style={{ ...th, backgroundColor: G, color: 'white', fontWeight: 'bold' }}>差引支給額</td>
            </tr>
            <tr>
              <td style={td}>{fmt(record.incomeTax)}</td>
              <td style={td}>{fmt(record.residentTax)}</td>
              <td style={td}></td>
              <td style={td}></td>
              <td style={{ ...td, fontWeight: 'bold', color: '#b85c58' }}>{record.totalDeductions.toLocaleString()}</td>
              <td style={{ ...td, fontWeight: 'bold', fontSize: 14, backgroundColor: GL, color: G }}>{record.netPay.toLocaleString()}</td>
            </tr>

            {/* 備考 */}
            <tr>
              <td colSpan={7} style={{ ...td, textAlign: 'left', minHeight: 36, height: 36 }}>
                <span style={{ fontSize: 10, color: '#888', marginRight: 8 }}>備考</span>
                {record.note}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
