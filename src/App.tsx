import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/AppContext";
import { AuthProvider } from "@/lib/AuthContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import CustomersPage from "@/pages/CustomersPage";
import JobsPage from "@/pages/JobsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import AgendaPage from "@/pages/AgendaPage";
import ServicesPage from "@/pages/ServicesPage";
import RoundsPage from "@/pages/RoundsPage";
import FinancePage from "@/pages/FinancePage";
import ExpensesPage from "@/pages/ExpensesPage";
import MileagePage from "@/pages/MileagePage";
import QuotesPage from "@/pages/QuotesPage";
import SettingsPage from "@/pages/SettingsPage";
import TeamPage from "@/pages/TeamPage";
import SuppliersPage from "@/pages/SuppliersPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/agenda" element={<AgendaPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/rounds" element={<RoundsPage />} />
                <Route path="/finances" element={<FinancePage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/mileage" element={<MileagePage />} />
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
