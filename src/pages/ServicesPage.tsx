import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Droplets, Home, Waves, CarFront, SprayCan, Wrench,
} from "lucide-react";
import type { Service } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_META: Record<Service["category"], { label: string; icon: typeof Droplets; badgeClass: string }> = {
  "window-cleaning": { label: "Window Cleaning", icon: Droplets, badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "gutter-cleaning": { label: "Gutter Cleaning", icon: Home, badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  "soffit-fascia": { label: "Soffit & Fascia", icon: SprayCan, badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  "jet-washing": { label: "Jet Washing", icon: Waves, badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  "caravan-cleaning": { label: "Caravan Cleaning", icon: CarFront, badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  custom: { label: "Custom", icon: Wrench, badgeClass: "bg-muted text-muted-foreground border-border" },
};

const CARAVAN_TIER_LABELS: Record<string, string> = {
  "full-external": "Full External",
  "roof-only": "Roof Only",
  "rinse-down": "Rinse Down",
};

type FormState = {
  name: string;
  category: Service["category"];
  description: string;
  defaultPrice: number;
  caravanTier?: Service["caravanTier"];
};

const emptyForm: FormState = { name: "", category: "custom", description: "", defaultPrice: 0 };

export default function ServicesPage() {
  const { services = [], customerServices = [], addService, updateService, deleteService } = useApp();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, category: s.category, description: s.description, defaultPrice: s.defaultPrice, caravanTier: s.caravanTier });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload: Omit<Service, "id"> = {
      name: form.name,
      category: form.category,
      description: form.description,
      defaultPrice: form.defaultPrice,
      ...(form.category === "caravan-cleaning" && form.caravanTier ? { caravanTier: form.caravanTier } : {}),
    };
    editing ? updateService(editing.id, payload) : addService(payload);
    setDialogOpen(false);
    toast({ title: editing ? "Service updated" : "Service added", description: form.name });
  };

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const categoryOrder: Service["category"][] = [
    "window-cleaning", "gutter-cleaning", "soffit-fascia", "jet-washing", "caravan-cleaning", "custom",
  ];

  return (
    <div className="pb-24 md:pb-0 flex flex-col gap-5">
      <PageHeader
        title="Services"
        description={`${services.length} service${services.length !== 1 ? "s" : ""} across ${Object.keys(grouped).length} categor${Object.keys(grouped).length !== 1 ? "ies" : "y"}`}
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
          </Button>
        }
      />

      <div className="flex flex-col gap-5 animate-fade-up stagger-1">
        {categoryOrder.filter((cat) => grouped[cat]?.length).map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const items = grouped[cat];

          return (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <div className={cn("flex h-6 w-6 items-center justify-center rounded border", meta.badgeClass)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[13px] font-semibold text-foreground">{meta.label}</span>
                <span className="text-[11px] text-muted-foreground font-mono">{items.length}</span>
              </div>

              {/* Service rows */}
              <div className="surface rounded-md overflow-hidden divide-y divide-border">
                {items.map((s) => {
                  const assignedCount = customerServices.filter((cs) => cs.serviceId === s.id).length;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-foreground">{s.name}</span>
                          {s.caravanTier && (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide", meta.badgeClass)}>
                              {CARAVAN_TIER_LABELS[s.caravanTier]}
                            </span>
                          )}
                          {assignedCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                              {assignedCount} customer{assignedCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                            {s.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {s.defaultPrice > 0 && (
                          <span className="font-mono text-[13px] font-semibold text-foreground mr-1">
                            {formatCurrency(s.defaultPrice)}
                          </span>
                        )}
                        {/* Actions: always visible on mobile, hover on desktop */}
                        <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => {
                              deleteService(s.id);
                              toast({ title: "Service deleted", description: s.name });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {services.length === 0 && (
          <div className="surface rounded-md p-10 text-center">
            <Wrench className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">No services yet — add one to get started.</p>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="label-caps mb-1.5 block">Service Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Gutter Cleaning"
              />
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Service["category"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "caravan-cleaning" && (
              <div>
                <Label className="label-caps mb-1.5 block">Caravan Tier</Label>
                <Select
                  value={form.caravanTier || ""}
                  onValueChange={(v) => setForm({ ...form, caravanTier: v as Service["caravanTier"] })}
                >
                  <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CARAVAN_TIER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="label-caps mb-1.5 block">Default Price (£)</Label>
              <Input
                type="number" min={0} step={0.5}
                value={form.defaultPrice || ""}
                onChange={(e) => setForm({ ...form, defaultPrice: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this service includes…"
                className="resize-none h-20 text-[13px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>
                {editing ? "Save Changes" : "Add Service"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
