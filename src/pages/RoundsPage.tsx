import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Users, ChevronDown, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Round } from "@/lib/store";

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
  "": "—",
};

const ROUND_COLOURS = [
  "#FF1CE9", "#3B82F6", "#22C55E", "#F59E0B",
  "#EF4444", "#8B5CF6", "#06B6D4", "#F97316",
];

const emptyForm = { name: "", day: "none", colour: "#3B82F6" };

export default function RoundsPage() {
  const { rounds, customers, addRound, updateRound, deleteRound, updateCustomer } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Round | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Round | null>(null);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const roundStats = useMemo(() => {
    const map: Record<string, typeof customers> = {};
    for (const r of rounds) map[r.id] = customers.filter((c) => c.roundId === r.id);
    return map;
  }, [rounds, customers]);

  const unassigned = useMemo(
    () => customers.filter((c) => !c.roundId || !rounds.some((r) => r.id === c.roundId)),
    [customers, rounds],
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: Round) => {
    setEditing(r);
    setForm({ name: r.name, day: r.day || "none", colour: r.colour });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const saveData = { ...form, day: (form.day === "none" ? "" : form.day) as Round["day"] };
    editing ? updateRound(editing.id, saveData) : addRound(saveData);
    setDialogOpen(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteRound(deleteTarget.id); setDeleteTarget(null); }
  };

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Rounds"
        description="Organise customers into cleaning rounds"
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> New Round
          </Button>
        }
      />

      {/* Summary cards */}
      {rounds.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-fade-up">
          {(() => {
            const assigned = customers.filter((c) => c.roundId && rounds.some((r) => r.id === c.roundId));
            const totalAssigned = assigned.length;
            const totalCustomers = customers.length;
            const weeklyValue = assigned.reduce((s, c) => {
              const freq = c.frequency;
              const price = c.pricePerClean;
              if (freq === "weekly") return s + price;
              if (freq === "fortnightly") return s + price / 2;
              if (freq === "monthly") return s + price / 4.33;
              if (freq === "6-weekly") return s + price / 6;
              if (freq === "quarterly") return s + price / 13;
              return s + price / 4.33;
            }, 0);
            const monthlyValue = weeklyValue * 4.33;
            return (
              <>
                <div className="surface rounded-md p-4">
                  <p className="label-caps mb-1">Assigned</p>
                  <p className="font-mono text-xl font-medium text-foreground">{totalAssigned}</p>
                  <p className="text-[11px] text-muted-foreground">of {totalCustomers} customers</p>
                </div>
                <div className="surface rounded-md p-4">
                  <p className="label-caps mb-1">Unassigned</p>
                  <p className="font-mono text-xl font-medium text-foreground">{unassigned.length}</p>
                  <p className="text-[11px] text-muted-foreground">{totalCustomers > 0 ? `${Math.round((unassigned.length / totalCustomers) * 100)}%` : "—"}</p>
                </div>
                <div className="surface rounded-md p-4">
                  <p className="label-caps mb-1">Weekly Value</p>
                  <p className="font-mono text-xl font-medium text-foreground">{formatCurrency(weeklyValue)}</p>
                  <p className="text-[11px] text-muted-foreground">{rounds.length} round{rounds.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="surface rounded-md p-4">
                  <p className="label-caps mb-1">Monthly Value</p>
                  <p className="font-mono text-xl font-medium text-foreground">{formatCurrency(monthlyValue)}</p>
                  <p className="text-[11px] text-muted-foreground">estimated</p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {rounds.length === 0 ? (
        <div className="surface rounded-md p-10 text-center animate-fade-up">
          <Map className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">No rounds yet — create one to group your customers.</p>
        </div>
      ) : (
        <div className="space-y-2 animate-fade-up">
          {rounds.map((round) => {
            const members = roundStats[round.id] ?? [];
            const totalValue = members.reduce((s, c) => s + c.pricePerClean, 0);
            const isExpanded = expandedRound === round.id;

            return (
              <div key={round.id} className="surface rounded-md overflow-hidden">
                {/* Round header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Colour swatch + expand button */}
                  <button
                    onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="h-8 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: round.colour }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground leading-tight">{round.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {round.day && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono uppercase tracking-wide">
                            {DAY_LABELS[round.day] ?? round.day}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {members.length} customer{members.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[11px] font-mono text-foreground">
                          {formatCurrency(totalValue)}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn("h-4 w-4 text-muted-foreground/40 transition-transform shrink-0", isExpanded && "rotate-180")}
                    />
                  </button>

                  {/* Edit / Delete */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); openEdit(round); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(round); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded members */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {members.length === 0 ? (
                      <p className="px-4 py-4 text-[12px] text-muted-foreground text-center">
                        No customers in this round yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {members.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-medium text-foreground truncate">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <span className="font-mono text-[12px] text-foreground">
                                {formatCurrency(c.pricePerClean)}
                              </span>
                              <button
                                onClick={() => updateCustomer(c.id, { roundId: undefined })}
                                className="text-[11px] text-muted-foreground/60 hover:text-destructive transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add unassigned customer to this round */}
                    {unassigned.length > 0 && (
                      <div className="px-4 py-3 border-t border-border bg-muted/5">
                        <Select onValueChange={(id) => updateCustomer(id, { roundId: round.id })}>
                          <SelectTrigger className="h-8 text-[12px]">
                            <SelectValue placeholder="Add customer to this round…" />
                          </SelectTrigger>
                          <SelectContent>
                            {unassigned.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-[12px]">
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned customers section */}
      {unassigned.length > 0 && rounds.length > 0 && (
        <div className="surface rounded-md overflow-hidden animate-fade-up">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[13px] font-semibold text-foreground">Unassigned</span>
            <Badge variant="secondary" className="ml-auto text-[10px] font-mono">
              {unassigned.length}
            </Badge>
          </div>
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {unassigned.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                </div>
                <Select onValueChange={(roundId) => updateCustomer(c.id, { roundId })}>
                  <SelectTrigger className="h-7 w-[140px] text-[11px] shrink-0">
                    <SelectValue placeholder="Assign round" />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-[12px]">
                        <span
                          className="inline-block h-2 w-2 rounded-full mr-1.5 shrink-0"
                          style={{ backgroundColor: r.colour }}
                        />
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Round" : "New Round"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="label-caps mb-1.5 block">Round Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Monday Round"
              />
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Day of Week</Label>
              <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })}>
                <SelectTrigger><SelectValue placeholder="Select a day" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No set day</SelectItem>
                  {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const).map((d) => (
                    <SelectItem key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Colour</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {ROUND_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, colour: c })}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      form.colour === c
                        ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110"
                        : "hover:scale-105 opacity-70 hover:opacity-100",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleSave} className="w-full" disabled={!form.name.trim()}>
              {editing ? "Save Changes" : "Create Round"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers in this round will become unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
