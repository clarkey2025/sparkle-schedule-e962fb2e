import { useState, useCallback } from "react";
import { generateMockData } from "./mockData";

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  frequency: "weekly" | "fortnightly" | "monthly" | "6-weekly" | "quarterly";
  pricePerClean: number;
  notes: string;
  createdAt: string;
  lat?: number;
  lng?: number;
  lastCleanDate?: string;
  nextDueDate?: string;
  importedBalance?: number;
}

export interface Job {
  id: string;
  customerId: string;
  date: string;
  status: "scheduled" | "completed" | "cancelled";
  price: number;
  notes: string;
}

export interface Payment {
  id: string;
  customerId: string;
  jobId?: string;
  amount: number;
  date: string;
  method: "cash" | "bank-transfer" | "card" | "other";
  notes: string;
}

export type CaravanTier = "full-external" | "roof-only" | "rinse-down";

export interface Service {
  id: string;
  name: string;
  category: "gutter-cleaning" | "soffit-fascia" | "jet-washing" | "caravan-cleaning" | "window-cleaning" | "custom";
  description: string;
  defaultPrice: number;
  caravanTier?: CaravanTier;
}

export interface CustomerService {
  id: string;
  customerId: string;
  serviceId: string;
  price: number;
  type: "recurring" | "one-off";
  frequency?: Customer["frequency"];
  notes: string;
}

const STORAGE_KEY = "pane-pro-data";

interface AppData {
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
  services: Service[];
  customerServices: CustomerService[];
}

const MOCK_VERSION = "v12-empty";
const MOCK_VERSION_KEY = "pane-pro-mock-version";

function loadData(): AppData {
  try {
    const seededVersion = localStorage.getItem(MOCK_VERSION_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);

    if (seededVersion !== MOCK_VERSION || !raw) {
      const mock = generateMockData();
      mock.customers = [];
      mock.jobs = [];
      mock.payments = [];
      mock.customerServices = [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
      localStorage.setItem(MOCK_VERSION_KEY, MOCK_VERSION);
      return mock;
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.customers !== undefined) {
        // Migrate old data missing new fields
        if (!parsed.services) parsed.services = generateMockData().services;
        if (!parsed.customerServices) parsed.customerServices = generateMockData().customerServices;

        // One-time migration: set monthly customers + "Darts Academy" due tomorrow
        const MIGRATE_KEY = "pane-pro-migrate-due-tomorrow-v3";
        if (!localStorage.getItem(MIGRATE_KEY)) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().slice(0, 10);
          parsed.customers = parsed.customers.map((c: Customer) => {
            if (c.frequency === "monthly" || c.name.toLowerCase().includes("darts academy")) {
              return { ...c, nextDueDate: tomorrowStr };
            }
            return c;
          });
          localStorage.setItem(MIGRATE_KEY, "done");
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }

        return parsed;
      }
    }
  } catch {}
  const mock = generateMockData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
  localStorage.setItem(MOCK_VERSION_KEY, MOCK_VERSION);
  return mock;
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const addCustomer = useCallback((c: Omit<Customer, "id" | "createdAt">) => {
    update((d) => ({
      ...d,
      customers: [...d.customers, { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
  }, [update]);

  const updateCustomer = useCallback((id: string, c: Partial<Customer>) => {
    update((d) => ({
      ...d,
      customers: d.customers.map((x) => (x.id === id ? { ...x, ...c } : x)),
    }));
  }, [update]);

  const deleteCustomer = useCallback((id: string) => {
    update((d) => ({
      ...d,
      customers: d.customers.filter((x) => x.id !== id),
      jobs: d.jobs.filter((j) => j.customerId !== id),
      payments: d.payments.filter((p) => p.customerId !== id),
      customerServices: d.customerServices.filter((cs) => cs.customerId !== id),
    }));
  }, [update]);

  const addJob = useCallback((j: Omit<Job, "id">) => {
    update((d) => ({ ...d, jobs: [...d.jobs, { ...j, id: crypto.randomUUID() }] }));
  }, [update]);

  const updateJob = useCallback((id: string, j: Partial<Job>) => {
    update((d) => ({ ...d, jobs: d.jobs.map((x) => (x.id === id ? { ...x, ...j } : x)) }));
  }, [update]);

  const deleteJob = useCallback((id: string) => {
    update((d) => ({ ...d, jobs: d.jobs.filter((x) => x.id !== id) }));
  }, [update]);

  const addPayment = useCallback((p: Omit<Payment, "id">) => {
    update((d) => ({ ...d, payments: [...d.payments, { ...p, id: crypto.randomUUID() }] }));
  }, [update]);

  const deletePayment = useCallback((id: string) => {
    update((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== id) }));
  }, [update]);

  // Services CRUD
  const addService = useCallback((s: Omit<Service, "id">) => {
    update((d) => ({ ...d, services: [...d.services, { ...s, id: crypto.randomUUID() }] }));
  }, [update]);

  const updateService = useCallback((id: string, s: Partial<Service>) => {
    update((d) => ({ ...d, services: d.services.map((x) => (x.id === id ? { ...x, ...s } : x)) }));
  }, [update]);

  const deleteService = useCallback((id: string) => {
    update((d) => ({
      ...d,
      services: d.services.filter((x) => x.id !== id),
      customerServices: d.customerServices.filter((cs) => cs.serviceId !== id),
    }));
  }, [update]);

  // Customer-service assignments
  const addCustomerService = useCallback((cs: Omit<CustomerService, "id">) => {
    update((d) => ({ ...d, customerServices: [...d.customerServices, { ...cs, id: crypto.randomUUID() }] }));
  }, [update]);

  const deleteCustomerService = useCallback((id: string) => {
    update((d) => ({ ...d, customerServices: d.customerServices.filter((x) => x.id !== id) }));
  }, [update]);

  return {
    ...data,
    addCustomer, updateCustomer, deleteCustomer,
    addJob, updateJob, deleteJob,
    addPayment, deletePayment,
    addService, updateService, deleteService,
    addCustomerService, deleteCustomerService,
  };
}
