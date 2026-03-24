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
  recurringExpenseId?: string;
}

export interface RecurringExpense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  dayOfMonth: number;
  active: boolean;
  createdAt: string;
}

export interface QuoteLineItem {
  serviceId: string;
  serviceName: string;
  description: string;
  price: number;
}

export interface Quote {
  id: string;
  customerId: string;
  /** For prospects not yet in the customer list */
  prospectName?: string;
  prospectAddress?: string;
  prospectPhone?: string;
  prospectEmail?: string;
  items: QuoteLineItem[];
  notes: string;
  status: "draft" | "sent" | "accepted" | "declined";
  createdAt: string;
  validUntil: string;
}

export interface MileageEntry {
  id: string;
  date: string;
  miles: number;
  notes: string;
}

export interface FuelSettings {
  pricePerLitre: number;
  mpg: number;
}

export interface BusinessSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
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
  recurringExpenses: RecurringExpense[];
  mileageEntries: MileageEntry[];
  fuelSettings: FuelSettings;
  businessSettings: BusinessSettings;
  quotes: Quote[];
}

const DEFAULT_FUEL_SETTINGS: FuelSettings = { pricePerLitre: 1.45, mpg: 35 };

export function calculateFuelCost(miles: number, settings: FuelSettings): number {
  // Convert MPG to miles per litre (1 gallon = 4.546 litres)
  const milesPerLitre = settings.mpg / 4.546;
  const litresUsed = miles / milesPerLitre;
  return litresUsed * settings.pricePerLitre;
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

function autoLogRecurringExpenses(data: AppData): AppData {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonth = todayStr.slice(0, 7);
  const REC_KEY = `pane-pro-recurring-exp-${thisMonth}`;
  if (localStorage.getItem(REC_KEY)) return data;

  const newExpenses = [...data.expenses];
  for (const re of (data.recurringExpenses || [])) {
    if (!re.active) continue;
    // Check if already logged this month for this recurring expense
    const alreadyLogged = newExpenses.some(
      (e) => e.recurringExpenseId === re.id && e.date.startsWith(thisMonth)
    );
    if (alreadyLogged) continue;
    // Log on the recurring day or today if that day has passed
    const today = new Date();
    const logDay = Math.min(re.dayOfMonth, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
    const logDate = new Date(today.getFullYear(), today.getMonth(), logDay);
    if (logDate <= today) {
      newExpenses.push({
        id: crypto.randomUUID(),
        amount: re.amount,
        date: logDate.toISOString().slice(0, 10),
        category: re.category,
        description: re.description,
        notes: "Auto-logged (recurring)",
        recurringExpenseId: re.id,
      });
    }
  }

  localStorage.setItem(REC_KEY, "1");
  if (newExpenses.length === data.expenses.length) return data;
  return { ...data, expenses: newExpenses };
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
      data = { ...mock, rounds: [], expenses: [], recurringExpenses: [], mileageEntries: [], fuelSettings: DEFAULT_FUEL_SETTINGS, quotes: [] };
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
        if (!parsed.expenses) parsed.expenses = [];
        if (!parsed.recurringExpenses) parsed.recurringExpenses = [];
        if (!parsed.mileageEntries) parsed.mileageEntries = [];
      if (!parsed.fuelSettings) parsed.fuelSettings = DEFAULT_FUEL_SETTINGS;
        if (!parsed.quotes) parsed.quotes = [];

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

        data = autoLogRecurringExpenses(autoScheduleJobs(parsed));
        saveData(data);
        return data;
      }
    }
  } catch {}
  const mock = generateMockData();
  data = { ...mock, rounds: [], expenses: [], recurringExpenses: [], mileageEntries: [], fuelSettings: DEFAULT_FUEL_SETTINGS, quotes: [] };
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

  // Expenses CRUD
  const addExpense = useCallback((e: Omit<Expense, "id">) => {
    update((d) => ({ ...d, expenses: [...d.expenses, { ...e, id: crypto.randomUUID() }] }));
  }, [update]);

  const updateExpense = useCallback((id: string, e: Partial<Expense>) => {
    update((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === id ? { ...x, ...e } : x)) }));
  }, [update]);

  const deleteExpense = useCallback((id: string) => {
    update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }));
  }, [update]);

  // Recurring Expenses CRUD
  const addRecurringExpense = useCallback((re: Omit<RecurringExpense, "id" | "createdAt">) => {
    update((d) => ({ ...d, recurringExpenses: [...d.recurringExpenses, { ...re, id: crypto.randomUUID(), createdAt: new Date().toISOString() }] }));
  }, [update]);

  const updateRecurringExpense = useCallback((id: string, re: Partial<RecurringExpense>) => {
    update((d) => ({ ...d, recurringExpenses: d.recurringExpenses.map((x) => (x.id === id ? { ...x, ...re } : x)) }));
  }, [update]);

  const deleteRecurringExpense = useCallback((id: string) => {
    update((d) => ({ ...d, recurringExpenses: d.recurringExpenses.filter((x) => x.id !== id) }));
  }, [update]);

  // Mileage CRUD
  const addMileageEntry = useCallback((m: Omit<MileageEntry, "id">) => {
    update((d) => ({ ...d, mileageEntries: [...d.mileageEntries, { ...m, id: crypto.randomUUID() }] }));
  }, [update]);

  const deleteMileageEntry = useCallback((id: string) => {
    update((d) => ({ ...d, mileageEntries: d.mileageEntries.filter((x) => x.id !== id) }));
  }, [update]);

  const updateFuelSettings = useCallback((s: Partial<FuelSettings>) => {
    update((d) => ({ ...d, fuelSettings: { ...d.fuelSettings, ...s } }));
  }, [update]);

  // Quotes CRUD
  const addQuote = useCallback((q: Omit<Quote, "id" | "createdAt">) => {
    update((d) => ({ ...d, quotes: [...d.quotes, { ...q, id: crypto.randomUUID(), createdAt: new Date().toISOString() }] }));
  }, [update]);

  const updateQuote = useCallback((id: string, q: Partial<Quote>) => {
    update((d) => ({ ...d, quotes: d.quotes.map((x) => (x.id === id ? { ...x, ...q } : x)) }));
  }, [update]);

  const deleteQuote = useCallback((id: string) => {
    update((d) => ({ ...d, quotes: d.quotes.filter((x) => x.id !== id) }));
  }, [update]);

  const loadMockData = useCallback(() => {
    const mock = generateMockData();
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonth = todayStr.slice(0, 7);
    const offsets = [-7, -3, -1, 0, 0, 1, 2, 5, -5, -2, 0, -4, 1, 0, -1, 3];
    mock.customers = mock.customers.map((c, i) => {
      const d = new Date();
      d.setDate(d.getDate() + (offsets[i % offsets.length]));
      return { ...c, nextDueDate: d.toISOString().slice(0, 10) };
    });
    localStorage.removeItem(`pane-pro-auto-sched-${todayStr}`);
    localStorage.removeItem(`pane-pro-recurring-exp-${thisMonth}`);
    const mockRecurring = generateMockRecurringExpenses();
    const withData: AppData = { ...mock, expenses: generateMockExpenses(), recurringExpenses: mockRecurring, mileageEntries: generateMockMileage(), fuelSettings: DEFAULT_FUEL_SETTINGS, quotes: [] };
    const scheduled = autoLogRecurringExpenses(autoScheduleJobs(withData));
    saveData(scheduled);
    localStorage.setItem(DEMO_FLAG_KEY, "1");
    setData(scheduled);
    setIsDemoActive(true);
  }, []);

  const clearMockData = useCallback(() => {
    const empty: AppData = {
      customers: [], jobs: [], payments: [],
      services: generateMockData().services,
      customerServices: [], rounds: [], expenses: [], recurringExpenses: [],
      mileageEntries: [], fuelSettings: DEFAULT_FUEL_SETTINGS, quotes: [],
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
    addExpense, updateExpense, deleteExpense,
    addRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
    addMileageEntry, deleteMileageEntry, updateFuelSettings,
    addQuote, updateQuote, deleteQuote,
    loadMockData,
    clearMockData,
  };
}

function generateMockExpenses(): Expense[] {
  const categories: ExpenseCategory[] = ["fuel", "supplies", "equipment", "insurance", "vehicle", "software"];
  const descriptions: Record<ExpenseCategory, string[]> = {
    fuel: ["Diesel top-up", "Fuel for van", "Petrol station"],
    supplies: ["Squeegee replacement", "Cleaning solution", "Microfibre cloths", "Purified water"],
    equipment: ["New extension pole", "Hose reel", "Water fed pole brush"],
    insurance: ["Monthly van insurance", "Public liability insurance"],
    vehicle: ["MOT & service", "New tyres", "Windscreen repair"],
    software: ["CRM subscription", "Accounting software"],
    marketing: ["Flyers printed", "Facebook ads"],
    other: ["Miscellaneous"],
  };
  const expenses: Expense[] = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const cat = categories[i % categories.length];
    const descs = descriptions[cat];
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * 180));
    expenses.push({
      id: crypto.randomUUID(),
      amount: parseFloat((5 + Math.random() * 80).toFixed(2)),
      date: d.toISOString().slice(0, 10),
      category: cat,
      description: descs[Math.floor(Math.random() * descs.length)],
      notes: "",
    });
  }
  return expenses.sort((a, b) => b.date.localeCompare(a.date));
}

function generateMockRecurringExpenses(): RecurringExpense[] {
  return [
    { id: crypto.randomUUID(), amount: 45, category: "insurance", description: "Public liability insurance", dayOfMonth: 1, active: true, createdAt: "2025-01-01T00:00:00.000Z" },
    { id: crypto.randomUUID(), amount: 85, category: "insurance", description: "Van insurance", dayOfMonth: 15, active: true, createdAt: "2025-01-01T00:00:00.000Z" },
    { id: crypto.randomUUID(), amount: 12.99, category: "software", description: "CRM subscription", dayOfMonth: 1, active: true, createdAt: "2025-03-01T00:00:00.000Z" },
    { id: crypto.randomUUID(), amount: 9.99, category: "software", description: "Accounting software", dayOfMonth: 5, active: true, createdAt: "2025-06-01T00:00:00.000Z" },
    { id: crypto.randomUUID(), amount: 35, category: "vehicle", description: "Van finance payment", dayOfMonth: 28, active: true, createdAt: "2024-06-01T00:00:00.000Z" },
  ];
}

function generateMockMileage(): MileageEntry[] {
  const entries: MileageEntry[] = [];
  const now = new Date();
  const notes = ["Round 1 - North area", "Round 2 - South side", "Emergency callout", "Quote visits", "Full day round", "Town centre jobs"];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * 90));
    entries.push({
      id: crypto.randomUUID(),
      date: d.toISOString().slice(0, 10),
      miles: parseFloat((5 + Math.random() * 60).toFixed(1)),
      notes: notes[Math.floor(Math.random() * notes.length)],
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
