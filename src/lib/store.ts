import { useState, useCallback } from "react";
import { generateMockData } from "./mockData";
import { getNextDueDate } from "./helpers";

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
  roundId?: string;
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

export interface Round {
  id: string;
  name: string;
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | "";
  colour: string;
  createdAt: string;
}

export type ExpenseCategory = "fuel" | "equipment" | "supplies" | "insurance" | "vehicle" | "marketing" | "software" | "other";

export interface Expense {
  id: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  description: string;
  notes: string;
}

const STORAGE_KEY = "pane-pro-data";

interface AppData {
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
  services: Service[];
  customerServices: CustomerService[];
  rounds: Round[];
  expenses: Expense[];
}

const MOCK_VERSION = "v12-empty";
const MOCK_VERSION_KEY = "pane-pro-mock-version";
const DEMO_FLAG_KEY = "pane-pro-demo-active";

export function isDemoDataActive(): boolean {
  return localStorage.getItem(DEMO_FLAG_KEY) === "1";
}

function autoScheduleJobs(data: AppData): AppData {
  const todayStr = new Date().toISOString().slice(0, 10);
  const AUTO_KEY = `pane-pro-auto-sched-${todayStr}`;
  if (localStorage.getItem(AUTO_KEY)) return data;

  const newJobs = [...data.jobs];
  const activeJobCustomerIds = new Set(
    data.jobs
      .filter((j) => j.status === "scheduled" || (j.status === "completed" && j.date === todayStr))
      .map((j) => j.customerId)
  );

  for (const c of data.customers) {
    if (!c.nextDueDate || c.nextDueDate > todayStr) continue;
    if (activeJobCustomerIds.has(c.id)) continue;
    newJobs.push({
      id: crypto.randomUUID(),
      customerId: c.id,
      date: todayStr,
      status: "scheduled" as const,
      price: c.pricePerClean,
      notes: c.nextDueDate < todayStr ? "Auto-scheduled (overdue)" : "",
    });
  }

  localStorage.setItem(AUTO_KEY, "1");
  if (newJobs.length === data.jobs.length) return data;
  return { ...data, jobs: newJobs };
}

function loadData(): AppData {
  let data: AppData;
  try {
    const seededVersion = localStorage.getItem(MOCK_VERSION_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);

    if (seededVersion !== MOCK_VERSION || !raw) {
      const mock = generateMockData();
      mock.customers = [];
      mock.jobs = [];
      mock.payments = [];
      mock.customerServices = [];
      data = { ...mock, rounds: [], expenses: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(MOCK_VERSION_KEY, MOCK_VERSION);
      data = autoScheduleJobs(data);
      saveData(data);
      return data;
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.customers !== undefined) {
        if (!parsed.services) parsed.services = generateMockData().services;
        if (!parsed.customerServices) parsed.customerServices = generateMockData().customerServices;
        if (!parsed.rounds) parsed.rounds = [];

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

        data = autoScheduleJobs(parsed);
        saveData(data);
        return data;
      }
    }
  } catch {}
  const mock = generateMockData();
  data = { ...mock, rounds: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(MOCK_VERSION_KEY, MOCK_VERSION);
  data = autoScheduleJobs(data);
  saveData(data);
  return data;
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);
  const [isDemoActive, setIsDemoActive] = useState<boolean>(isDemoDataActive);

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

  // Rounds CRUD
  const addRound = useCallback((r: Omit<Round, "id" | "createdAt">) => {
    update((d) => ({ ...d, rounds: [...d.rounds, { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString() }] }));
  }, [update]);

  const updateRound = useCallback((id: string, r: Partial<Round>) => {
    update((d) => ({ ...d, rounds: d.rounds.map((x) => (x.id === id ? { ...x, ...r } : x)) }));
  }, [update]);

  const deleteRound = useCallback((id: string) => {
    update((d) => ({
      ...d,
      rounds: d.rounds.filter((x) => x.id !== id),
      customers: d.customers.map((c) => c.roundId === id ? { ...c, roundId: undefined } : c),
    }));
  }, [update]);

  const loadMockData = useCallback(() => {
    const mock = generateMockData();
    // Assign nextDueDate to mock customers so auto-scheduling works
    const todayStr = new Date().toISOString().slice(0, 10);
    const offsets = [-7, -3, -1, 0, 0, 1, 2, 5, -5, -2, 0, -4, 1, 0, -1, 3];
    mock.customers = mock.customers.map((c, i) => {
      const d = new Date();
      d.setDate(d.getDate() + (offsets[i % offsets.length]));
      return { ...c, nextDueDate: d.toISOString().slice(0, 10) };
    });
    // Clear the auto-schedule key so it re-runs for the new data
    localStorage.removeItem(`pane-pro-auto-sched-${todayStr}`);
    const scheduled = autoScheduleJobs(mock);
    saveData(scheduled);
    localStorage.setItem(DEMO_FLAG_KEY, "1");
    setData(scheduled);
    setIsDemoActive(true);
  }, []);

  const clearMockData = useCallback(() => {
    const empty: AppData = {
      customers: [], jobs: [], payments: [],
      services: generateMockData().services,
      customerServices: [], rounds: [],
    };
    saveData(empty);
    localStorage.removeItem(DEMO_FLAG_KEY);
    setData(empty);
    setIsDemoActive(false);
  }, []);


  

  return {
    ...data,
    isDemoActive,
    addCustomer, updateCustomer, deleteCustomer,
    addJob, updateJob, deleteJob,
    addPayment, deletePayment,
    addService, updateService, deleteService,
    addCustomerService, deleteCustomerService,
    addRound, updateRound, deleteRound,
    loadMockData,
    clearMockData,
  };
}
