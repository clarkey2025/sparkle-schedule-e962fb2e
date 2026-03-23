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
import {
  Plus, Trash2, Pencil, Users, ChevronRight, Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Round } from "@/lib/store";

const DAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
  "": "No set day",
};

const ROUND_COLOURS = [
  "#FF1CE9", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#F97316",
];

const emptyForm = { name: "", day: "none", colour: "#FF1CE9" };

export default function RoundsPage() {
  const { rounds, customers, addRound, updateRound, deleteRound, updateCustomer } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Round | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Round | null>(null);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const roundStats = useMemo(() => {
    const map: Record<string, typeof customers> = {};
    for (const r of rounds) {
      map[r.id] = customers.filter((c) => c.roundId === r.id);
    }
    return map;
  }, [rounds, customers]);

  const unassigned = useMemo(() => customers.filter((c) => !c.roundId || !rounds.some((r) => r.id === c.roundId)), [customers, rounds]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: Round) => { setEditing(r); setForm({ name: r.name, day: (r.day || "none") as Round["day"], colour: r.colour }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const saveData = { ...form, day: (form.day === "none" ? "" : form.day) as Round["day"] };
    if (editing) {
      updateRound(editing.id, saveData);
    } else {
      addRound(saveData);
    }
    setDialogOpen(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteRound(deleteTarget.id); setDeleteTarget(null); }
  };

  const assignToRound = (customerId: string, roundId: string | undefined) => {
    updateCustomer(customerId, { roundId });
  };

  return (
    <div className="pb-24 md:pb-0 space-y-4">
      <PageHeader
        title="Rounds"
        description="Organise customers into cleaning rounds"
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> New Round
          </Button>
        }
      />

      {/* Round cards */}
      {rounds.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-8 text-center">
          <Map className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">No rounds yet — create one to group your customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const members = roundStats[round.id] ?? [];
            const totalValue = members.reduce((s, c) => s + c.pricePerClean, 0);
            const isExpanded = expandedRound === round.id;

            return (
              <div key={round.id} className="bg-card border border-border rounded-md overflow-hidden animate-fade-up">
                <button
                  onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: round.colour }} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{round.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {DAY_LABELS[round.day]} · {members.length} customer{members.length !== 1 ? "s" : ""} · {formatCurrency(totalValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(round); }}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(round); }}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground/30 transition-transform", isExpanded && "rotate-90")} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {members.length === 0 ? (
                      <p className="px-4 py-4 text-[12px] text-muted-foreground/50 text-center">No customers in this round yet.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {members.map((c) => (
                          <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10 transition-colors">
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="font-mono text-[11px] text-foreground">{formatCurrency(c.pricePerClean)}</span>
                              <button
                                onClick={() => assignToRound(c.id, undefined)}
                                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assign unassigned customers */}
                    {unassigned.length > 0 && (
                      <div className="px-4 py-3 border-t border-border bg-muted/10">
                        <Select onValueChange={(id) => assignToRound(id, round.id)}>
                          <SelectTrigger className="h-8 text-[12px]">
                            <SelectValue placeholder="+ Add customer to this round" />
                          </SelectTrigger>
                          <SelectContent>
                            {unassigned.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-[12px]">{c.name}</SelectItem>
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

      {/* Unassigned customers */}
      {unassigned.length > 0 && rounds.length > 0 && (
        <div className="bg-card border border-border rounded-md overflow-hidden animate-fade-up">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Users className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[13px] font-semibold text-foreground">Unassigned</span>
            <span className="ml-auto text-[11px] text-muted-foreground font-mono">{unassigned.length}</span>
          </div>
          <div className="divide-y divide-border max-h-56 overflow-y-auto">
            {unassigned.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10 transition-colors">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                </div>
                <Select onValueChange={(roundId) => assignToRound(c.id, roundId)}>
                  <SelectTrigger className="h-7 w-[140px] text-[11px] shrink-0 ml-2">
                    <SelectValue placeholder="Assign round" />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-[12px]">
                        <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: r.colour }} />
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

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm border-border/50">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Round" : "New Round"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[11px]">Round Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monday Round" />
            </div>
            <div>
              <Label className="text-[11px]">Day of Week</Label>
              <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v as Round["day"] })}>
                <SelectTrigger><SelectValue placeholder="Select a day" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No set day</SelectItem>
                  {Object.entries(DAY_LABELS).filter(([k]) => k !== "").map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Colour</Label>
              <div className="flex gap-2 mt-1.5">
                {ROUND_COLOURS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, colour: c })}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      form.colour === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : "hover:scale-105"
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
