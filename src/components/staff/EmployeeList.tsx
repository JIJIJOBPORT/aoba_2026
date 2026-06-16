'use client';

import { useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Employee } from '@/types';
import { cn } from '@/lib/utils';

const EMPLOYMENT_TYPE_COLOR: Record<string, string> = {
  正社員: 'bg-[#e8f0ef] text-[#34675C]',
  契約社員: 'bg-green-100 text-green-700',
  パート: 'bg-orange-100 text-orange-700',
  アルバイト: 'bg-purple-100 text-purple-700',
};

interface Props {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (employee: Employee) => void;
  onAddClick: () => void;
}

export default function EmployeeList({ employees, selectedId, onSelect, onAddClick }: Props) {
  const [query, setQuery] = useState('');

  const filtered = employees.filter(
    (e) =>
      e.name.includes(query) ||
      e.id.includes(query) ||
      e.department.includes(query)
  );

  return (
    <div className="w-64 border-r border-gray-200 flex flex-col bg-white">
      {/* ヘッダー */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">スタッフ一覧</h2>
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#34675C] text-white text-xs rounded-lg hover:bg-[#2a5249] transition-colors"
          >
            <UserPlus size={14} />
            スタッフ追加
          </button>
        </div>
        {/* 検索 */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="名前・社員番号で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#86AC41]"
          />
        </div>
      </div>

      {/* リスト */}
      <div className="flex-1 overflow-y-auto">
        {/* ヘッダー行 */}
        <div className="grid grid-cols-3 px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
          <span>社員番号</span>
          <span>名前</span>
          <span>雇用形態</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            スタッフが見つかりません
          </div>
        ) : (
          filtered.map((emp) => (
            <button
              key={emp.id}
              onClick={() => onSelect(emp)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left',
                selectedId === emp.id && 'bg-[#f0f5f4] border-l-2 border-l-[#86AC41]'
              )}
            >
              {/* アバター */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#34675C] to-[#324851] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {emp.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{emp.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-gray-400">{emp.id}</span>
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      EMPLOYMENT_TYPE_COLOR[emp.employmentType] ?? 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {emp.employmentType}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
