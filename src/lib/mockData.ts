import type { Customer, Job, Payment, Service, CustomerService } from "./store";

// Today = 2026-03-22 — customers in/around Fleetwood, Lancashire
const CUSTOMERS: Customer[] = [
  {
    id: "c1", name: "Margaret Harlow", address: "14 Elm Grove, Fleetwood, FY7 6LB",
    phone: "07712 340182", email: "m.harlow@outlook.com",
    frequency: "monthly", pricePerClean: 18, notes: "Side gate always unlocked.",
    createdAt: "2024-06-12T09:00:00.000Z", lat: 53.9230, lng: -3.0055,
  },
  {
    id: "c2", name: "David Nettles", address: "7 Beach Road, Cleveleys, FY5 1LZ",
    phone: "07834 910423", email: "d.nettles@gmail.com",
    frequency: "fortnightly", pricePerClean: 24, notes: "",
    createdAt: "2024-07-03T10:30:00.000Z", lat: 53.8791, lng: -3.0371,
  },
  {
    id: "c3", name: "Sandra Briggs", address: "22 Oak Avenue, Thornton-Cleveleys, FY5 2HA",
    phone: "07901 234567", email: "sandra.briggs@hotmail.co.uk",
    frequency: "6-weekly", pricePerClean: 32, notes: "Two dogs — keep gate shut.",
    createdAt: "2024-05-20T11:00:00.000Z", lat: 53.8762, lng: -2.9992,
  },
  {
    id: "c4", name: "Paul & Karen Whitmore", address: "5 Mill Road, Poulton-le-Fylde, FY6 7AE",
    phone: "07700 901123", email: "pwhitmore@icloud.com",
    frequency: "monthly", pricePerClean: 20, notes: "",
    createdAt: "2024-08-14T14:00:00.000Z", lat: 53.8481, lng: -2.9963,
  },
  {
    id: "c5", name: "Terry Yates", address: "31 Birch Close, Preesall, FY6 0HP",
    phone: "07788 554321", email: "terry.yates@btinternet.com",
    frequency: "fortnightly", pricePerClean: 15, notes: "Cash only. Leave invoice in letterbox.",
    createdAt: "2024-09-01T09:00:00.000Z", lat: 53.9092, lng: -2.9421,
  },
  {
    id: "c6", name: "Anita Sharma", address: "8 Victoria Road, Knott End-on-Sea, FY6 0AJ",
    phone: "07956 112233", email: "anita.s84@gmail.com",
    frequency: "monthly", pricePerClean: 22, notes: "",
    createdAt: "2024-10-10T10:00:00.000Z", lat: 53.9305, lng: -2.9980,
  },
  {
    id: "c7", name: "Robert Finch", address: "19 Station Road, Garstang, PR3 1DZ",
    phone: "07623 445566", email: "r.finch@gmail.com",
    frequency: "quarterly", pricePerClean: 45, notes: "Large property — 3 storey. Bring extension pole.",
    createdAt: "2024-04-22T11:30:00.000Z", lat: 53.8942, lng: -2.7791,
  },
  {
    id: "c8", name: "Helen Cross", address: "3 Meadow View, Fleetwood, FY7 7LX",
    phone: "07811 998877", email: "helcross@hotmail.com",
    frequency: "monthly", pricePerClean: 18, notes: "",
    createdAt: "2025-01-08T09:00:00.000Z", lat: 53.9178, lng: -3.0101,
  },
  {
    id: "c9", name: "Colin Baker", address: "12 Highfield Drive, Blackpool, FY2 0PJ",
    phone: "07745 667788", email: "colinbaker56@yahoo.co.uk",
    frequency: "monthly", pricePerClean: 20, notes: "Key in lockbox: 4419.",
    createdAt: "2024-11-15T13:00:00.000Z", lat: 53.8407, lng: -3.0441,
  },
  {
    id: "c10", name: "Fiona Marsh", address: "6 Orchard Way, Cleveleys, FY5 3PA",
    phone: "07932 110099", email: "fiona.marsh@gmail.com",
    frequency: "weekly", pricePerClean: 12, notes: "Pay by bank transfer each month.",
    createdAt: "2025-02-17T10:00:00.000Z", lat: 53.8720, lng: -3.0188,
  },
  {
    id: "c11", name: "Joyce Pemberton", address: "45 Dock Street, Fleetwood, FY7 6JT",
    phone: "07811 223344", email: "j.pemberton@gmail.com",
    frequency: "monthly", pricePerClean: 16, notes: "Ring bell twice — hard of hearing.",
    createdAt: "2025-03-01T09:00:00.000Z", lat: 53.9271, lng: -3.0142,
  },
  {
    id: "c12", name: "Gary & Sue Platt", address: "9 Rossall Lane, Fleetwood, FY7 8HZ",
    phone: "07900 556677", email: "garyplatt@outlook.com",
    frequency: "fortnightly", pricePerClean: 22, notes: "Van on drive — squeeze past left side.",
    createdAt: "2025-03-05T10:30:00.000Z", lat: 53.9082, lng: -3.0265,
  },
  {
    id: "c13", name: "Norah Eccles", address: "2 Warren Drive, Cleveleys, FY5 2QA",
    phone: "07733 881122", email: "noraheccles@btinternet.com",
    frequency: "monthly", pricePerClean: 18, notes: "Conservatory included in price.",
    createdAt: "2025-02-10T11:00:00.000Z", lat: 53.8840, lng: -3.0320,
  },
  {
    id: "c14", name: "Kevin Draper", address: "17 Poulton Road, Blackpool, FY3 7AS",
    phone: "07855 990011", email: "kev.draper@yahoo.co.uk",
    frequency: "monthly", pricePerClean: 20, notes: "",
    createdAt: "2025-01-20T09:00:00.000Z", lat: 53.8311, lng: -3.0178,
  },
  {
    id: "c15", name: "Pauline Holt", address: "33 Queens Terrace, Fleetwood, FY7 6BT",
    phone: "07712 667788", email: "pholt@hotmail.co.uk",
    frequency: "fortnightly", pricePerClean: 14, notes: "Front only — no rear access.",
    createdAt: "2025-04-01T10:00:00.000Z", lat: 53.9245, lng: -3.0098,
  },
  {
    id: "c16", name: "Dennis Waldron", address: "11 Lonsdale Road, Cleveleys, FY5 1ST",
    phone: "07966 334455", email: "d.waldron@gmail.com",
    frequency: "6-weekly", pricePerClean: 28, notes: "Key under flowerpot by back door.",
    createdAt: "2025-02-28T14:00:00.000Z", lat: 53.8755, lng: -3.0290,
  },
];

const JOBS: Job[] = [
  // ── Margaret Harlow (monthly) — OVERDUE
  { id: "j1", customerId: "c1", date: "2026-01-28", status: "completed", price: 18, notes: "" },
  { id: "j2", customerId: "c1", date: "2025-12-30", status: "completed", price: 18, notes: "" },
  { id: "j3", customerId: "c1", date: "2025-11-29", status: "completed", price: 18, notes: "" },

  // ── David Nettles (fortnightly) — up to date
  { id: "j4", customerId: "c2", date: "2026-03-16", status: "completed", price: 24, notes: "" },
  { id: "j5", customerId: "c2", date: "2026-03-02", status: "completed", price: 24, notes: "" },
  { id: "j6", customerId: "c2", date: "2026-02-17", status: "completed", price: 24, notes: "" },
  { id: "j7", customerId: "c2", date: "2026-03-30", status: "scheduled", price: 24, notes: "" },

  // ── Sandra Briggs (6-weekly) — VERY OVERDUE
  { id: "j8", customerId: "c3", date: "2025-12-10", status: "completed", price: 32, notes: "" },
  { id: "j9", customerId: "c3", date: "2025-10-29", status: "completed", price: 32, notes: "" },

  // ── Paul & Karen Whitmore (monthly) — due Mar 25
  { id: "j10", customerId: "c4", date: "2026-02-25", status: "completed", price: 20, notes: "" },
  { id: "j11", customerId: "c4", date: "2026-01-26", status: "completed", price: 20, notes: "" },
  { id: "j12", customerId: "c4", date: "2026-03-25", status: "scheduled", price: 20, notes: "" },

  // ── Terry Yates (fortnightly) — OVERDUE
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

  // ── Helen Cross (monthly) — TODAY ✓
  { id: "j22", customerId: "c8", date: "2026-02-22", status: "completed", price: 18, notes: "" },
  { id: "j23", customerId: "c8", date: "2026-01-22", status: "completed", price: 18, notes: "" },
  { id: "j24", customerId: "c8", date: "2026-03-22", status: "scheduled", price: 18, notes: "" },

  // ── Colin Baker (monthly) — OVERDUE
  { id: "j25", customerId: "c9", date: "2026-01-15", status: "completed", price: 20, notes: "" },
  { id: "j26", customerId: "c9", date: "2025-12-17", status: "completed", price: 20, notes: "" },

  // ── Fiona Marsh (weekly) — TODAY ✓
  { id: "j27", customerId: "c10", date: "2026-03-18", status: "completed", price: 12, notes: "" },
  { id: "j28", customerId: "c10", date: "2026-03-11", status: "completed", price: 12, notes: "" },
  { id: "j29", customerId: "c10", date: "2026-03-04", status: "completed", price: 12, notes: "" },
  { id: "j30", customerId: "c10", date: "2026-02-25", status: "completed", price: 12, notes: "" },
  { id: "j31", customerId: "c10", date: "2026-03-22", status: "scheduled", price: 12, notes: "" },
  { id: "j32", customerId: "c10", date: "2026-03-29", status: "scheduled", price: 12, notes: "" },

  // ── Joyce Pemberton (monthly) — TODAY ✓
  { id: "j33", customerId: "c11", date: "2026-02-22", status: "completed", price: 16, notes: "" },
  { id: "j34", customerId: "c11", date: "2026-03-22", status: "scheduled", price: 16, notes: "" },

  // ── Gary & Sue Platt (fortnightly) — TODAY ✓
  { id: "j35", customerId: "c12", date: "2026-03-08", status: "completed", price: 22, notes: "" },
  { id: "j36", customerId: "c12", date: "2026-03-22", status: "scheduled", price: 22, notes: "" },
  { id: "j37", customerId: "c12", date: "2026-04-05", status: "scheduled", price: 22, notes: "" },

  // ── Norah Eccles (monthly) — TODAY ✓
  { id: "j38", customerId: "c13", date: "2026-02-22", status: "completed", price: 18, notes: "" },
  { id: "j39", customerId: "c13", date: "2026-03-22", status: "scheduled", price: 18, notes: "" },

  // ── Kevin Draper (monthly) — TODAY ✓
  { id: "j40", customerId: "c14", date: "2026-02-22", status: "completed", price: 20, notes: "" },
  { id: "j41", customerId: "c14", date: "2026-03-22", status: "scheduled", price: 20, notes: "" },
  { id: "j42", customerId: "c14", date: "2026-04-22", status: "scheduled", price: 20, notes: "" },

  // ── Pauline Holt (fortnightly) — TODAY ✓
  { id: "j43", customerId: "c15", date: "2026-03-08", status: "completed", price: 14, notes: "" },
  { id: "j44", customerId: "c15", date: "2026-03-22", status: "scheduled", price: 14, notes: "" },

  // ── Dennis Waldron (6-weekly) — TODAY ✓
  { id: "j45", customerId: "c16", date: "2026-02-09", status: "completed", price: 28, notes: "" },
  { id: "j46", customerId: "c16", date: "2026-03-22", status: "scheduled", price: 28, notes: "" },
];

const PAYMENTS: Payment[] = [
  { id: "p1", customerId: "c2", amount: 24, date: "2026-03-16", method: "bank-transfer", notes: "" },
  { id: "p2", customerId: "c2", amount: 24, date: "2026-03-02", method: "bank-transfer", notes: "" },
  { id: "p3", customerId: "c2", amount: 24, date: "2026-02-17", method: "bank-transfer", notes: "" },
  { id: "p4", customerId: "c3", amount: 32, date: "2025-10-29", method: "cash", notes: "" },
  { id: "p5", customerId: "c4", amount: 20, date: "2026-02-25", method: "card", notes: "" },
  { id: "p6", customerId: "c4", amount: 20, date: "2026-01-26", method: "card", notes: "" },
  { id: "p7", customerId: "c5", amount: 15, date: "2026-01-23", method: "cash", notes: "Left envelope under mat" },
  { id: "p8", customerId: "c6", amount: 22, date: "2026-03-01", method: "bank-transfer", notes: "" },
  { id: "p9", customerId: "c6", amount: 22, date: "2026-02-01", method: "bank-transfer", notes: "" },
  { id: "p10", customerId: "c7", amount: 45, date: "2026-01-20", method: "bank-transfer", notes: "" },
  { id: "p11", customerId: "c7", amount: 45, date: "2025-10-20", method: "bank-transfer", notes: "" },
  { id: "p12", customerId: "c8", amount: 18, date: "2026-02-22", method: "cash", notes: "" },
  { id: "p13", customerId: "c8", amount: 18, date: "2026-01-22", method: "cash", notes: "" },
  { id: "p14", customerId: "c9", amount: 20, date: "2025-12-17", method: "cash", notes: "Key lockbox" },
  { id: "p15", customerId: "c10", amount: 48, date: "2026-03-01", method: "bank-transfer", notes: "March batch payment" },
  { id: "p16", customerId: "c10", amount: 48, date: "2026-02-01", method: "bank-transfer", notes: "Feb batch payment" },
  { id: "p17", customerId: "c11", amount: 16, date: "2026-02-22", method: "cash", notes: "" },
  { id: "p18", customerId: "c12", amount: 22, date: "2026-03-08", method: "bank-transfer", notes: "" },
  { id: "p19", customerId: "c13", amount: 18, date: "2026-02-22", method: "card", notes: "" },
  { id: "p20", customerId: "c14", amount: 20, date: "2026-02-22", method: "bank-transfer", notes: "" },
  { id: "p21", customerId: "c15", amount: 14, date: "2026-03-08", method: "cash", notes: "" },
  { id: "p22", customerId: "c16", amount: 28, date: "2026-02-09", method: "bank-transfer", notes: "" },
];

const SERVICES: Service[] = [
  { id: "sv1", name: "Window Cleaning", category: "window-cleaning", description: "Standard residential window clean — interior & exterior.", defaultPrice: 0 },
  { id: "sv2", name: "Gutter Cleaning", category: "gutter-cleaning", description: "Full gutter clear-out including downpipes. Vacuum & flush.", defaultPrice: 45 },
  { id: "sv3", name: "Soffit & Fascia Cleaning", category: "soffit-fascia", description: "Pressure-safe clean of soffits, fascias & bargeboards.", defaultPrice: 60 },
  { id: "sv4", name: "Jet Washing", category: "jet-washing", description: "Driveways, patios, paths & decking. Price per m².", defaultPrice: 80 },
  { id: "sv5", name: "Caravan Cleaning — Full External", category: "caravan-cleaning", description: "Complete exterior wash including roof, walls & windows.", defaultPrice: 55, caravanTier: "full-external" },
  { id: "sv6", name: "Caravan Cleaning — Roof Only", category: "caravan-cleaning", description: "Roof wash & treat. Removes moss, algae & black streaks.", defaultPrice: 35, caravanTier: "roof-only" },
  { id: "sv7", name: "Caravan Cleaning — Rinse Down", category: "caravan-cleaning", description: "Quick rinse & dry. Ideal for pre-holiday prep.", defaultPrice: 20, caravanTier: "rinse-down" },
];

const CUSTOMER_SERVICES: CustomerService[] = [
  { id: "cs1", customerId: "c3", serviceId: "sv2", price: 45, type: "recurring", frequency: "quarterly", notes: "Autumn & spring priority" },
  { id: "cs2", customerId: "c7", serviceId: "sv3", price: 70, type: "recurring", frequency: "6-weekly", notes: "Large property surcharge" },
  { id: "cs3", customerId: "c4", serviceId: "sv4", price: 90, type: "one-off", notes: "Patio only — booked for April" },
  { id: "cs4", customerId: "c1", serviceId: "sv5", price: 55, type: "one-off", notes: "Static caravan at Cala Gran" },
  { id: "cs5", customerId: "c10", serviceId: "sv7", price: 20, type: "recurring", frequency: "monthly", notes: "Touring caravan on drive" },
  { id: "cs6", customerId: "c12", serviceId: "sv2", price: 40, type: "recurring", frequency: "6-weekly", notes: "" },
];

export function generateMockData() {
  return { customers: CUSTOMERS, jobs: JOBS, payments: PAYMENTS, services: SERVICES, customerServices: CUSTOMER_SERVICES };
}
