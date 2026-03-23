import { Outlet, useNavigate, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";
import TopBar from "./TopBar";
import { Plus, CalendarCheck } from "lucide-react";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const hideFab = path === "/customers" || path === "/jobs";
  const isAgenda = path === "/agenda";

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

      {/* Mobile FAB — context-aware (hidden on desktop & pages with their own add button) */}
      {!hideFab && (
        <button
          onClick={() => navigate(isAgenda ? "/jobs?add=1" : "/customers?add=1")}
          className="fixed right-4 bottom-[68px] z-[45] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform md:hidden"
          aria-label={isAgenda ? "Log job" : "Add customer"}
        >
          {isAgenda ? <CalendarCheck className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
}
