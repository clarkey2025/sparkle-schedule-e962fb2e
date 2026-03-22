export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  "6-weekly": "6-Weekly",
  quarterly: "Quarterly",
};

export function getNextDueDate(lastClean: string | undefined, frequency: string): Date {
  const base = lastClean ? new Date(lastClean) : new Date();
  const d = new Date(base);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "fortnightly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "6-weekly": d.setDate(d.getDate() + 42); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
  }
  return d;
}
