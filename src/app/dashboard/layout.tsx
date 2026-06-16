import Sidebar from '@/components/layout/Sidebar';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProviderWrapper>
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SessionProviderWrapper>
  );
}
