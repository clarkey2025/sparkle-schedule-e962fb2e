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

const STORAGE_KEY = "pane-pro-data";

interface AppData {
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
}

const MOCK_VERSION = "v4";
const MOCK_VERSION_KEY = "pane-pro-mock-version";

function loadData(): AppData {
  try {
    const seededVersion = localStorage.getItem(MOCK_VERSION_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);

    // Re-seed if never seeded, or if mock version changed and no real edits exist
    if (seededVersion !== MOCK_VERSION || !raw) {
      const mock = generateMockData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
      localStorage.setItem(MOCK_VERSION_KEY, MOCK_VERSION);
      return mock;
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.customers !== undefined) return parsed;
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

  return {
    ...data,
    addCustomer, updateCustomer, deleteCustomer,
    addJob, updateJob, deleteJob,
    addPayment, deletePayment,
  };
}
