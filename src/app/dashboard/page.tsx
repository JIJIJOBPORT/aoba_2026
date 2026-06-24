'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Employee } from '@/types';
import { cn } from '@/lib/utils';
import EmployeeList from '@/components/staff/EmployeeList';
import EmployeeDetail from '@/components/staff/EmployeeDetail';

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  // スマホ用: 一覧 / 詳細 の切り替え（lg以上では常に両方表示）
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEmployees(d.data);
          if (d.data.length > 0) setSelected(d.data[0]);
        } else {
          setError(d.error);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-700 font-semibold mb-2">エラーが発生しました</h3>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-screen">
      {/* 中央：スタッフリスト（スマホでは詳細表示中は隠す） */}
      <div className={cn('lg:block', mobileView === 'detail' && 'hidden')}>
        <EmployeeList
          employees={employees}
          selectedId={selected?.id ?? null}
          onSelect={(emp) => { setSelected(emp); setMobileView('detail'); }}
          onAddClick={() => {}}
        />
      </div>

      {/* 右：スタッフ詳細（スマホでは一覧表示中は隠す） */}
      <div className={cn('flex-1 min-w-0 overflow-auto p-4', mobileView === 'list' && 'hidden lg:block')}>
        {selected ? (
          <>
            <button
              onClick={() => setMobileView('list')}
              className="lg:hidden flex items-center gap-1 mb-3 text-sm text-[#34675C] font-medium"
            >
              <ArrowLeft size={16} />
              スタッフ一覧へ戻る
            </button>
            <EmployeeDetail employee={selected} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            スタッフを選択してください
          </div>
        )}
      </div>
    </div>
  );
}
