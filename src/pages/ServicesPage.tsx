import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Wrench, Tag, Palette, FolderPlus, MoreVertical,
} from "lucide-react";
import type { Service, ServiceCategory } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ── Colour options for categories ── */
const COLOUR_OPTIONS = [
  { value: "violet", class: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { value: "pink", class: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  { value: "orange", class: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "lime", class: "bg-lime-500/10 text-lime-400 border-lime-500/20" },
  { value: "teal", class: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  { value: "sky", class: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  { value: "fuchsia", class: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" },
  { value: "yellow", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
];

function getColourClass(colour: string) {
  return COLOUR_OPTIONS.find((c) => c.value === colour)?.class ?? "bg-muted text-muted-foreground border-border";
}

type FormState = {
  name: string;
  category: string;
  description: string;
  defaultPrice: number;
};

const emptyForm: FormState = { name: "", category: "_none", description: "", defaultPrice: 0 };

export default function ServicesPage() {
  const {
    services = [], customerServices = [], serviceCategories = [],
    addService, updateService, deleteService,
    addServiceCategory, updateServiceCategory, deleteServiceCategory,
  } = useApp();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Category management
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catForm, setCatForm] = useState({ label: "", colour: "violet" });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, category: s.category || "_none", description: s.description, defaultPrice: s.defaultPrice });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload: Omit<Service, "id"> = {
      name: form.name,
      category: form.category === "_none" ? "" : form.category,
      description: form.description,
      defaultPrice: form.defaultPrice,
    };
    editing ? updateService(editing.id, payload) : addService(payload);
    setDialogOpen(false);
    toast({ title: editing ? "Service updated" : "Service added", description: form.name });
  };

  const openAddCat = () => { setEditingCat(null); setCatForm({ label: "", colour: "violet" }); setCatDialogOpen(true); };
  const openEditCat = (c: ServiceCategory) => { setEditingCat(c); setCatForm({ label: c.label, colour: c.colour }); setCatDialogOpen(true); };

  const handleSaveCat = () => {
    if (!catForm.label.trim()) return;
    if (editingCat) {
      updateServiceCategory(editingCat.id, { label: catForm.label, colour: catForm.colour });
      toast({ title: "Category updated", description: catForm.label });
    } else {
      addServiceCategory({ label: catForm.label, colour: catForm.colour, icon: "tag" });
      toast({ title: "Category added", description: catForm.label });
    }
    setCatDialogOpen(false);
  };

  const handleDeleteCat = (c: ServiceCategory) => {
    deleteServiceCategory(c.id);
    toast({ title: "Category deleted", description: `${c.label} — services moved to Uncategorised` });
  };

  /* ── Grouping ── */
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const key = s.category || "_uncategorised";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  // Categories in order, then uncategorised at the end
  const categoryOrder = [
    ...serviceCategories.map((c) => c.id).filter((id) => grouped[id]?.length),
    ...(grouped["_uncategorised"]?.length ? ["_uncategorised"] : []),
  ];

  /* ── Category options for service form ── */
  const allCategoryOptions = [
    { value: "_none", label: "Uncategorised" },
    ...serviceCategories.map((c) => ({ value: c.id, label: c.label })),
  ];

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Services"
        description={`${services.length} service${services.length !== 1 ? "s" : ""} across ${categoryOrder.length} categor${categoryOrder.length !== 1 ? "ies" : "y"}`}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={openAddCat} size="sm" variant="outline">
              <FolderPlus className="h-3.5 w-3.5 mr-1" /> New Category
            </Button>
            <Button onClick={openAdd} size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 animate-fade-up stagger-1">
        {categoryOrder.map((catId) => {
          const isUncategorised = catId === "_uncategorised";
          const cat = serviceCategories.find((c) => c.id === catId);
          const badgeClass = cat ? getColourClass(cat.colour) : "bg-muted text-muted-foreground border-border";
          const items = grouped[catId];

          return (
            <div key={catId}>
              <div className="flex items-center gap-2.5 mb-2.5 px-0.5 group/cat">
                <div className={cn("flex h-6 w-6 items-center justify-center rounded-sm border", badgeClass)}>
                  {isUncategorised ? <Wrench className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {isUncategorised ? "Uncategorised" : cat?.label}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">{items.length}</span>

                {/* Category 3-dot menu (not for uncategorised) */}
                {!isUncategorised && cat && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="ml-auto md:ml-0 md:opacity-0 md:group-hover/cat:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => openEditCat(cat)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteCat(cat)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

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
                          <span className="text-sm font-medium text-foreground">{s.name}</span>
                          {assignedCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                              {assignedCount} customer{assignedCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                            {s.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {s.defaultPrice > 0 && (
                          <span className="font-mono text-sm font-medium text-foreground">
                            {formatCurrency(s.defaultPrice)}
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                deleteService(s.id);
                                toast({ title: "Service deleted", description: s.name });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {services.length === 0 && (
          <EmptyState icon={Wrench} message="No services yet — add one to get started." />
        )}
      </div>

      {/* Add / Edit Service dialog */}
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
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {allCategoryOptions.map((opt) => (
                    <SelectItem key={opt.value || "_none"} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

      {/* Add / Edit Category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={(o) => { if (!o) setCatDialogOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="label-caps mb-1.5 block">Category Name *</Label>
              <Input
                value={catForm.label}
                onChange={(e) => setCatForm({ ...catForm, label: e.target.value })}
                placeholder="e.g. Conservatory Cleaning"
              />
            </div>
            <div>
              <Label className="label-caps mb-2 block">
                <Palette className="h-3.5 w-3.5 inline mr-1" /> Colour
              </Label>
              <div className="flex flex-wrap gap-2">
                {COLOUR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCatForm({ ...catForm, colour: c.value })}
                    className={cn(
                      "h-7 w-7 rounded-md border-2 transition-all",
                      c.class,
                      catForm.colour === c.value
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                        : "opacity-60 hover:opacity-100",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCat} disabled={!catForm.label.trim()}>
                {editingCat ? "Save" : "Create Category"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
