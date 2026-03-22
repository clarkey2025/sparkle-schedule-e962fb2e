import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <MobileNav />
      <div className="md:pl-56 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1">
          <div className="mx-auto max-w-5xl px-6 py-7 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
