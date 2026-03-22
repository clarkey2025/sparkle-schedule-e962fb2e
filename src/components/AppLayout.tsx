import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="h-dvh bg-background overflow-hidden">
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <MobileNav />
      <div className="md:pl-56 flex flex-col h-full">
        <TopBar />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="mx-auto max-w-5xl px-6 py-7 md:px-8 h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
