import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="h-dvh bg-background flex overflow-hidden">
      <div className="hidden md:block shrink-0">
        <AppSidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <MobileNav />
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-7 md:px-8 h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
