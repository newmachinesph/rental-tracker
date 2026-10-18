import Sidebar from "@/components/Sidebar";
import DataLoader from "@/components/DataLoader";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      <Sidebar />
      <main className="flex-1 ml-[260px] p-6 lg:p-8 transition-all duration-300 overflow-x-hidden max-w-[calc(100vw-260px)]">
        <DataLoader>
          <div className="animate-page-enter">
            {children}
          </div>
        </DataLoader>
      </main>
    </div>
  );
}
