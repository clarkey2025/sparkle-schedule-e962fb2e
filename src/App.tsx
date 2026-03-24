import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/AppContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CustomersPage from "@/pages/CustomersPage";
import JobsPage from "@/pages/JobsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import AgendaPage from "@/pages/AgendaPage";
import RoutePage from "@/pages/RoutePage";
import ServicesPage from "@/pages/ServicesPage";
import RoundsPage from "@/pages/RoundsPage";
import FinancePage from "@/pages/FinancePage";
import QuotesPage from "@/pages/QuotesPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/rounds" element={<RoundsPage />} />
              <Route path="/finances" element={<FinancePage />} />
              <Route path="/route" element={<RoutePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
