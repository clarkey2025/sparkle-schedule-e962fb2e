import type { Customer, Job, Payment } from "./store";

// Today = 2026-03-22
const CUSTOMERS: Customer[] = [
  {
    id: "c1", name: "Margaret Harlow", address: "14 Elm Grove, Fairford, GL7 4AB",
    phone: "07712 340182", email: "m.harlow@outlook.com",
    frequency: "monthly", pricePerClean: 18, notes: "Side gate always unlocked.",
    createdAt: "2024-06-12T09:00:00.000Z",
  },
  {
    id: "c2", name: "David Nettles", address: "7 Church Lane, Cirencester, GL7 2BQ",
    phone: "07834 910423", email: "d.nettles@gmail.com",
    frequency: "fortnightly", pricePerClean: 24, notes: "",
    createdAt: "2024-07-03T10:30:00.000Z",
  },
  {
    id: "c3", name: "Sandra Briggs", address: "22 Oak Avenue, Tetbury, GL8 8EF",
    phone: "07901 234567", email: "sandra.briggs@hotmail.co.uk",
    frequency: "6-weekly", pricePerClean: 32, notes: "Two dogs — keep gate shut.",
    createdAt: "2024-05-20T11:00:00.000Z",
  },
  {
    id: "c4", name: "Paul & Karen Whitmore", address: "5 Mill Road, Stroud, GL5 1AL",
    phone: "07700 901123", email: "pwhitmore@icloud.com",
    frequency: "monthly", pricePerClean: 20, notes: "",
    createdAt: "2024-08-14T14:00:00.000Z",
  },
  {
    id: "c5", name: "Terry Yates", address: "31 Birch Close, Nailsworth, GL6 0DP",
    phone: "07788 554321", email: "terry.yates@btinternet.com",
    frequency: "fortnightly", pricePerClean: 15, notes: "Cash only. Leave invoice in letterbox.",
    createdAt: "2024-09-01T09:00:00.000Z",
  },
  {
    id: "c6", name: "Anita Sharma", address: "8 Victoria Place, Cheltenham, GL50 4AH",
    phone: "07956 112233", email: "anita.s84@gmail.com",
    frequency: "monthly", pricePerClean: 22, notes: "",
    createdAt: "2024-10-10T10:00:00.000Z",
  },
  {
    id: "c7", name: "Robert Finch", address: "19 Station Road, Dursley, GL11 4LX",
    phone: "07623 445566", email: "r.finch@gmail.com",
    frequency: "quarterly", pricePerClean: 45, notes: "Large property — 3 storey. Bring extension pole.",
    createdAt: "2024-04-22T11:30:00.000Z",
  },
  {
    id: "c8", name: "Helen Cross", address: "3 Meadow View, Lechlade, GL7 3DN",
    phone: "07811 998877", email: "helcross@hotmail.com",
    frequency: "monthly", pricePerClean: 18, notes: "",
    createdAt: "2025-01-08T09:00:00.000Z",
  },
  {
    id: "c9", name: "Colin Baker", address: "12 Highfield Drive, Bourton-on-the-Water, GL54 2LQ",
    phone: "07745 667788", email: "colinbaker56@yahoo.co.uk",
    frequency: "monthly", pricePerClean: 20, notes: "Key in lockbox: 4419.",
    createdAt: "2024-11-15T13:00:00.000Z",
  },
  {
    id: "c10", name: "Fiona Marsh", address: "6 Orchard Way, Winchcombe, GL54 5PJ",
    phone: "07932 110099", email: "fiona.marsh@gmail.com",
    frequency: "weekly", pricePerClean: 12, notes: "Pay by bank transfer each month.",
    createdAt: "2025-02-17T10:00:00.000Z",
  },
];

const JOBS: Job[] = [
  // ── Margaret Harlow (monthly) — OVERDUE (last clean Jan 28, due Feb 28 → 22d late)
  { id: "j1", customerId: "c1", date: "2026-01-28", status: "completed", price: 18, notes: "" },
  { id: "j2", customerId: "c1", date: "2025-12-30", status: "completed", price: 18, notes: "" },
  { id: "j3", customerId: "c1", date: "2025-11-29", status: "completed", price: 18, notes: "" },

  // ── David Nettles (fortnightly) — up to date, next due Mar 30
  { id: "j4", customerId: "c2", date: "2026-03-16", status: "completed", price: 24, notes: "" },
  { id: "j5", customerId: "c2", date: "2026-03-02", status: "completed", price: 24, notes: "" },
  { id: "j6", customerId: "c2", date: "2026-02-17", status: "completed", price: 24, notes: "" },
  { id: "j7", customerId: "c2", date: "2026-03-30", status: "scheduled", price: 24, notes: "" },

  // ── Sandra Briggs (6-weekly) — VERY OVERDUE (last clean Dec 10, due Jan 21 → 60d late)
  { id: "j8", customerId: "c3", date: "2025-12-10", status: "completed", price: 32, notes: "" },
  { id: "j9", customerId: "c3", date: "2025-10-29", status: "completed", price: 32, notes: "" },

  // ── Paul & Karen Whitmore (monthly) — due in 3 days (Mar 25)
  { id: "j10", customerId: "c4", date: "2026-02-25", status: "completed", price: 20, notes: "" },
  { id: "j11", customerId: "c4", date: "2026-01-26", status: "completed", price: 20, notes: "" },
  { id: "j12", customerId: "c4", date: "2026-03-25", status: "scheduled", price: 20, notes: "" },

  // ── Terry Yates (fortnightly) — OVERDUE (last clean Feb 20, due Mar 6 → 16d late)
  { id: "j13", customerId: "c5", date: "2026-02-20", status: "completed", price: 15, notes: "" },
  { id: "j14", customerId: "c5", date: "2026-02-06", status: "completed", price: 15, notes: "" },
  { id: "j15", customerId: "c5", date: "2026-01-23", status: "completed", price: 15, notes: "" },

  // ── Anita Sharma (monthly) — due Apr 1
  { id: "j16", customerId: "c6", date: "2026-03-01", status: "completed", price: 22, notes: "" },
  { id: "j17", customerId: "c6", date: "2026-02-01", status: "completed", price: 22, notes: "" },
  { id: "j18", customerId: "c6", date: "2026-04-01", status: "scheduled", price: 22, notes: "" },

  // ── Robert Finch (quarterly) — due Apr 20
  { id: "j19", customerId: "c7", date: "2026-01-20", status: "completed", price: 45, notes: "" },
  { id: "j20", customerId: "c7", date: "2025-10-20", status: "completed", price: 45, notes: "" },
  { id: "j21", customerId: "c7", date: "2026-04-20", status: "scheduled", price: 45, notes: "" },

  // ── Helen Cross (monthly) — scheduled TODAY (Mar 22)
  { id: "j22", customerId: "c8", date: "2026-02-22", status: "completed", price: 18, notes: "" },
  { id: "j23", customerId: "c8", date: "2026-01-22", status: "completed", price: 18, notes: "" },
  { id: "j24", customerId: "c8", date: "2026-03-22", status: "scheduled", price: 18, notes: "" },

  // ── Colin Baker (monthly) — OVERDUE (last clean Jan 15, due Feb 15 → 35d late)
  { id: "j25", customerId: "c9", date: "2026-01-15", status: "completed", price: 20, notes: "" },
  { id: "j26", customerId: "c9", date: "2025-12-17", status: "completed", price: 20, notes: "" },

  // ── Fiona Marsh (weekly) — scheduled TODAY (Mar 22)
  { id: "j27", customerId: "c10", date: "2026-03-18", status: "completed", price: 12, notes: "" },
  { id: "j28", customerId: "c10", date: "2026-03-11", status: "completed", price: 12, notes: "" },
  { id: "j29", customerId: "c10", date: "2026-03-04", status: "completed", price: 12, notes: "" },
  { id: "j30", customerId: "c10", date: "2026-02-25", status: "completed", price: 12, notes: "" },
  { id: "j31", customerId: "c10", date: "2026-03-22", status: "scheduled", price: 12, notes: "" },
  { id: "j32", customerId: "c10", date: "2026-03-29", status: "scheduled", price: 12, notes: "" },
];

const PAYMENTS: Payment[] = [
  // Margaret Harlow — UNPAID (£54 owed)
  // (no payments — oldest overdue)

  // David Nettles — fully paid
  { id: "p1", customerId: "c2", amount: 24, date: "2026-03-16", method: "bank-transfer", notes: "" },
  { id: "p2", customerId: "c2", amount: 24, date: "2026-03-02", method: "bank-transfer", notes: "" },
  { id: "p3", customerId: "c2", amount: 24, date: "2026-02-17", method: "bank-transfer", notes: "" },

  // Sandra Briggs — partial (£32 paid of £64)
  { id: "p4", customerId: "c3", amount: 32, date: "2025-10-29", method: "cash", notes: "" },

  // Paul & Karen Whitmore — fully paid
  { id: "p5", customerId: "c4", amount: 20, date: "2026-02-25", method: "card", notes: "" },
  { id: "p6", customerId: "c4", amount: 20, date: "2026-01-26", method: "card", notes: "" },

  // Terry Yates — partial (£15 paid of £45)
  { id: "p7", customerId: "c5", amount: 15, date: "2026-01-23", method: "cash", notes: "Left envelope under mat" },

  // Anita Sharma — fully paid
  { id: "p8", customerId: "c6", amount: 22, date: "2026-03-01", method: "bank-transfer", notes: "" },
  { id: "p9", customerId: "c6", amount: 22, date: "2026-02-01", method: "bank-transfer", notes: "" },

  // Robert Finch — fully paid
  { id: "p10", customerId: "c7", amount: 45, date: "2026-01-20", method: "bank-transfer", notes: "" },
  { id: "p11", customerId: "c7", amount: 45, date: "2025-10-20", method: "bank-transfer", notes: "" },

  // Helen Cross — fully paid (completed jobs only)
  { id: "p12", customerId: "c8", amount: 18, date: "2026-02-22", method: "cash", notes: "" },
  { id: "p13", customerId: "c8", amount: 18, date: "2026-01-22", method: "cash", notes: "" },

  // Colin Baker — partial (£20 paid of £40)
  { id: "p14", customerId: "c9", amount: 20, date: "2025-12-17", method: "cash", notes: "Key lockbox" },

  // Fiona Marsh — fully paid (bank transfer monthly)
  { id: "p15", customerId: "c10", amount: 48, date: "2026-03-01", method: "bank-transfer", notes: "March batch payment" },
  { id: "p16", customerId: "c10", amount: 48, date: "2026-02-01", method: "bank-transfer", notes: "Feb batch payment" },
];

export function generateMockData() {
  return { customers: CUSTOMERS, jobs: JOBS, payments: PAYMENTS };
}
