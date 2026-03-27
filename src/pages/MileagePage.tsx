import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Trash2, Car, Fuel, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateFuelCost } from "@/lib/store";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export default function MileagePage() {
  const { mileageEntries, fuelSettings, addMileageEntry, deleteMileageEntry, updateFuelSettings } = useApp();
  const { toast } = useToast();

  const [mileageDialogOpen, setMileageDialogOpen] = useState(false);
  const [fuelSettingsOpen, setFuelSettingsOpen] = useState(false);
  const [mileageForm, setMileageForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), miles: 0, notes: "" });
  const [page, setPage] = useState(1);

  const metrics = useMemo(() => {
    const totalMiles = mileageEntries.reduce((s, m) => s + m.miles, 0);
    const totalFuelCost = calculateFuelCost(totalMiles, fuelSettings);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthMiles = mileageEntries.filter((m) => m.date.startsWith(thisMonth)).reduce((s, m) => s + m.miles, 0);
    const thisMonthFuel = calculateFuelCost(thisMonthMiles, fuelSettings);
    return { totalMiles, totalFuelCost, thisMonthMiles, thisMonthFuel };
  }, [mileageEntries, fuelSettings]);

  const sorted = useMemo(() => [...mileageEntries].sort((a, b) => b.date.localeCompare(a.date)), [mileageEntries]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAddMileage = () => {
    if (mileageForm.miles <= 0) return;
    addMileageEntry({ date: mileageForm.date, miles: mileageForm.miles, notes: mileageForm.notes.trim() });
    const fuelCost = calculateFuelCost(mileageForm.miles, fuelSettings);
    toast({ title: "Mileage logged", description: `${mileageForm.miles} miles — est. fuel ${formatCurrency(fuelCost)}` });
    setMileageForm({ date: format(new Date(), "yyyy-MM-dd"), miles: 0, notes: "" });
    setMileageDialogOpen(false);
  };

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Mileage"
        description="Track miles and auto-calculate fuel costs"
        action={
          <Button size="sm" onClick={() => { setMileageForm({ date: format(new Date(), "yyyy-MM-dd"), miles: 0, notes: "" }); setMileageDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Log Mileage
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up">
        <StatCard label="Total Miles" value={metrics.totalMiles.toFixed(0)} icon={Car} colour="text-primary" />
        <StatCard label="Est. Fuel Cost" value={formatCurrency(metrics.totalFuelCost)} icon={Fuel} colour="text-destructive" />
        <StatCard label="This Month Miles" value={metrics.thisMonthMiles.toFixed(0)} icon={Car} colour="text-primary" />
        <StatCard label="This Month Fuel" value={formatCurrency(metrics.thisMonthFuel)} icon={Fuel} colour="text-warning" />
      </div>

      {/* Fuel settings */}
      <div className="bg-card border border-border rounded-md p-4 animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-medium text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" /> Fuel Cost Settings
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatCurrency(fuelSettings.pricePerLitre)}/litre · {fuelSettings.mpg} MPG · ~{formatCurrency(calculateFuelCost(1, fuelSettings))}/mile
          </p>
        </div>
        {fuelSettingsOpen ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-caps mb-1.5 block">Price per Litre (£)</Label>
              <Input type="number" min={0} step={0.01} value={fuelSettings.pricePerLitre} onChange={(e) => updateFuelSettings({ pricePerLitre: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Miles per Gallon</Label>
              <Input type="number" min={1} step={1} value={fuelSettings.mpg} onChange={(e) => updateFuelSettings({ mpg: parseFloat(e.target.value) || 1 })} />
            </div>
            <div className="col-span-2">
              <Button size="sm" variant="outline" onClick={() => setFuelSettingsOpen(false)}>
                <Check className="h-3.5 w-3.5 mr-1" /> Done
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setFuelSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" /> Edit Settings
          </Button>
        )}
      </div>

      {/* Mileage log */}
      {paginated.length === 0 ? (
        <div className="surface rounded-md p-10 text-center animate-fade-up">
          <Car className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No mileage entries yet.</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">Track daily miles to auto-calculate fuel costs.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up">
          <div className="bg-card border border-border rounded-md divide-y divide-border">
            {paginated.map((m) => {
              const fuelCost = calculateFuelCost(m.miles, fuelSettings);
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Car className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">
                        {m.miles.toFixed(1)} miles
                        <span className="text-muted-foreground font-normal ml-2">≈ {formatCurrency(fuelCost)} fuel</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatDate(m.date)}{m.notes ? ` · ${m.notes}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive" onClick={() => { deleteMileageEntry(m.id); toast({ title: "Mileage entry deleted" }); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}</p>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem><PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} className={safePage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                  <PaginationItem><span className="text-[12px] text-muted-foreground px-3 py-2 tabular-nums">{safePage} / {totalPages}</span></PaginationItem>
                  <PaginationItem><PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={safePage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {/* Log Mileage Dialog */}
      <Dialog open={mileageDialogOpen} onOpenChange={setMileageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log Mileage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-caps mb-1.5 block">Miles *</Label>
                <Input type="number" min={0} step={0.1} value={mileageForm.miles || ""} onChange={(e) => setMileageForm({ ...mileageForm, miles: parseFloat(e.target.value) || 0 })} placeholder="0.0" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Date</Label>
                <Input type="date" value={mileageForm.date} onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })} />
              </div>
            </div>
            {mileageForm.miles > 0 && (
              <div className="bg-muted/30 border border-border rounded-md p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Estimated fuel cost</p>
                <p className="font-mono text-lg font-medium text-warning">{formatCurrency(calculateFuelCost(mileageForm.miles, fuelSettings))}</p>
                <p className="text-[10px] text-muted-foreground">{fuelSettings.mpg} MPG · {formatCurrency(fuelSettings.pricePerLitre)}/litre</p>
              </div>
            )}
            <div>
              <Label className="label-caps mb-1.5 block">Notes</Label>
              <Input value={mileageForm.notes} onChange={(e) => setMileageForm({ ...mileageForm, notes: e.target.value })} placeholder="e.g. Round 1 — North area" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setMileageDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddMileage} disabled={mileageForm.miles <= 0}>
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
