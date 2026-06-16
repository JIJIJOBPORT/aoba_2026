'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FileText, DollarSign, List, Settings, Building2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'スタッフ一覧', icon: Users },
  { href: '/dashboard/attendance', label: '勤怠入力', icon: Clock },
  { href: '/dashboard/payroll-entry', label: '給与情報登録', icon: DollarSign },
  { href: '/dashboard/payroll-list', label: '給与明細一覧', icon: List },
  { href: '/dashboard/reports', label: '帳票出力', icon: FileText },
  { href: '/dashboard/settings', label: '設定', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen text-white flex flex-col" style={{ backgroundColor: '#324851' }}>
      {/* ロゴ */}
      <div className="flex items-center gap-2 px-4 py-5" style={{ borderBottom: '1px solid #7DA3A1' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#86AC41' }}>
          <Building2 size={18} />
        </div>
        <span className="text-sm font-semibold leading-tight">
          スタッフ情報・<br />給与管理アプリ
        </span>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 py-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
              pathname === href ? 'text-white' : 'text-slate-300'
            )}
            style={pathname === href ? { backgroundColor: '#34675C' } : undefined}
            onMouseEnter={(e) => {
              if (pathname !== href) (e.currentTarget as HTMLElement).style.backgroundColor = '#7DA3A1';
            }}
            onMouseLeave={(e) => {
              if (pathname !== href) (e.currentTarget as HTMLElement).style.backgroundColor = '';
            }}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* 会社名 */}
      <div className="px-4 py-4 text-xs" style={{ borderTop: '1px solid #7DA3A1', color: '#7DA3A1' }}>
        <p className="font-medium text-white">あおば整骨院</p>
        <p>管理者</p>
      </div>
    </aside>
  );
}
