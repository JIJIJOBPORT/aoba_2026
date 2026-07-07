'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Employee, PayrollRecord } from '@/types';
import { Pencil, Mail, Phone, Building2, Calendar, X } from 'lucide-react';
import PayrollTable from '@/components/payroll/PayrollTable';
import PayrollDetail from '@/components/payroll/PayrollDetail';
import { formatMonth } from '@/lib/utils';

interface Props {
  employee: Employee;
}

const TABS = ['基本情報', '給与情報', '振込口座', '勤怠情報', '備考'] as const;
type Tab = typeof TABS[number];

export default function EmployeeDetail({ employee }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('給与情報');
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelectedPayroll(null);
    fetch(`/api/payroll?employeeId=${employee.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPayrolls(d.data);
        }
      })
      .finally(() => setLoading(false));
  }, [employee.id]);

  return (
    <div className="flex gap-4 h-full">
      {/* 左：スタッフ詳細 */}
      <div className="flex-1 min-w-0">
        {/* プロフィールヘッダー */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#34675C] to-[#324851] flex items-center justify-center text-white text-2xl font-bold">
                {employee.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-800">{employee.name}</h2>
                  <span className="text-xs bg-[#e8f0ef] text-[#34675C] px-2 py-0.5 rounded-full">
                    {employee.employmentType}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{employee.nameKana}</p>
              </div>
            </div>
            <button className="flex items-center gap-1 text-xs text-[#34675C] border border-[#7DA3A1] px-3 py-1.5 rounded-lg hover:bg-[#f0f5f4] transition-colors">
              <Pencil size={12} />
              編集
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <InfoItem label="社員番号" value={employee.id} />
            <InfoItem label="入社日" value={employee.hireDate} icon={<Calendar size={12} />} />
            <InfoItem label="メールアドレス" value={employee.email} icon={<Mail size={12} />} />
            <InfoItem label="電話番号" value={employee.phone} icon={<Phone size={12} />} />
            <InfoItem label="所属部署" value={employee.department} icon={<Building2 size={12} />} />
            <InfoItem label="役職" value={employee.position} />
            <InfoItem label="生年月日" value={employee.birthDate} />
            <InfoItem label="扶養人数" value={`${employee.dependents}人`} />
          </div>
        </div>

        {/* タブ */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex border-b border-gray-200 px-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-[#34675C] text-[#34675C]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === '給与情報' && (
              loading ? (
                <div className="text-center py-8 text-sm text-gray-400">読み込み中...</div>
              ) : (
                <PayrollTable
                  records={payrolls}
                  selectedId={selectedPayroll?.id ?? null}
                  onSelect={setSelectedPayroll}
                  onAddClick={() => router.push(`/dashboard/payroll-entry?employeeId=${employee.id}`)}
                />
              )
            )}
            {activeTab === '基本情報' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="基本給" value={`${employee.basicSalary.toLocaleString()}円`} />
                <InfoItem label="各種手当" value={`${employee.allowances.toLocaleString()}円`} />
              </div>
            )}
            {activeTab === '振込口座' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="銀行名" value={employee.bankName} />
                <InfoItem label="支店名" value={employee.bankBranch} />
                <InfoItem label="口座種別" value={employee.bankAccountType} />
                <InfoItem label="口座番号" value={employee.bankAccountNumber} />
              </div>
            )}
            {(activeTab === '勤怠情報' || activeTab === '備考') && (
              <div className="text-sm text-gray-400 text-center py-8">準備中</div>
            )}
          </div>
        </div>
      </div>

      {/* 明細モーダル */}
      {selectedPayroll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">
                {employee.name}｜{formatMonth(selectedPayroll.paymentMonth)} 給与明細
              </h2>
              <button
                onClick={() => setSelectedPayroll(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 sm:p-5 overflow-x-auto">
              <PayrollDetail employee={employee} record={selectedPayroll} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="flex items-center gap-1 text-gray-700 font-medium">
        {icon}
        {value || '—'}
      </p>
    </div>
  );
}
