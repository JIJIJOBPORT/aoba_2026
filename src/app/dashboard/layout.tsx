import Sidebar from '@/components/layout/Sidebar';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProviderWrapper>
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </SessionProviderWrapper>
  );
}
