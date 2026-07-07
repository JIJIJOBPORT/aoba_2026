'use client';

import { PayrollRecord } from '@/types';
import { formatMonth } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  records: PayrollRecord[];
  selectedId: string | null;
  onSelect: (record: PayrollRecord) => void;
  onAddClick: () => void;
}

export default function PayrollTable({ records, selectedId, onSelect, onAddClick }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">給与情報</h3>
        <button
          onClick={onAddClick}
          className="px-3 py-1.5 bg-[#34675C] text-white text-xs rounded-lg hover:bg-[#2a5249] transition-colors"
        >
          ＋ 給与情報を追加
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 bg-gray-50 rounded-lg">
          給与データがありません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left py-2 pr-4">支給月</th>
                <th className="text-right py-2 pr-4">基本給</th>
                <th className="text-right py-2 pr-4">各種手当</th>
                <th className="text-right py-2 pr-4">控除額</th>
                <th className="text-right py-2 pr-4">支給額</th>
                <th className="text-center py-2">明細</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr
                  key={rec.id}
                  className={cn(
                    'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    selectedId === rec.id && 'bg-[#f0f5f4]'
                  )}
                >
                  <td className="py-2.5 pr-4 font-medium text-gray-700">
                    {formatMonth(rec.paymentMonth)}
                    {rec.recordType === '賞与' && (
                      <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                        賞与
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-600">
                    {rec.basicSalary.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-600">
                    {rec.allowances.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[#b85c58]">
                    {rec.totalDeductions.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-gray-800">
                    {rec.netPay.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => onSelect(rec)}
                      className="text-xs text-[#34675C] hover:text-[#2a5249] border border-[#7DA3A1] px-2 py-0.5 rounded hover:bg-[#f0f5f4] transition-colors"
                    >
                      明細表示
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
