'use client';

import { useState, useEffect } from 'react';
import { Employee } from '@/types';
import EmployeeList from '@/components/staff/EmployeeList';
import EmployeeDetail from '@/components/staff/EmployeeDetail';

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
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
    <div className="flex h-screen">
      {/* 中央：スタッフリスト */}
      <EmployeeList
        employees={employees}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        onAddClick={() => {}}
      />

      {/* 右：スタッフ詳細 */}
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <EmployeeDetail employee={selected} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            スタッフを選択してください
          </div>
        )}
      </div>
    </div>
  );
}
