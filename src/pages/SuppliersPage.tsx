import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, Package, Phone, Mail, Globe, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@/lib/store";

const PAGE_SIZE = 5;

const SUPPLIER_CATEGORIES = [
  "Cleaning Supplies", "Equipment", "Vehicle", "Insurance", "Software", "Fuel", "Other",
];

type FormState = {
  name: string; contactName: string; phone: string; email: string;
  website: string; category: string; notes: string;
};

const emptyForm: FormState = {
  name: "", contactName: "", phone: "", email: "", website: "", category: "Cleaning Supplies", notes: "",
};

export default function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contactName: s.contactName, phone: s.phone, email: s.email, website: s.website, category: s.category, notes: s.notes });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      updateSupplier(editing.id, form);
      toast({ title: "Supplier updated", description: form.name });
    } else {
      addSupplier(form);
      toast({ title: "Supplier added", description: form.name });
    }
    setDialogOpen(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Suppliers"
        description={`${suppliers.length} supplier${suppliers.length !== 1 ? "s" : ""}`}
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Supplier
          </Button>
        }
      />

      {suppliers.length > 0 && (
        <div className="relative max-w-xs animate-fade-up">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search suppliers…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      )}

      {paginated.length === 0 ? (
        <div className="surface rounded-md p-10 text-center animate-fade-up">
          <Package className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {suppliers.length === 0 ? "No suppliers yet — add your first one." : "No results found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up">
          <div className="surface rounded-md overflow-hidden divide-y divide-border">
            {paginated.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    {s.contactName && <span className="text-[11px] text-muted-foreground">({s.contactName})</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{s.category}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[12px] text-muted-foreground flex-wrap">
                    {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                    {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                    {s.website && (
                      <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-primary hover:underline">
                        <Globe className="h-3 w-3" />Website
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => { deleteSupplier(s.id); toast({ title: "Supplier removed", description: s.name }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, PAGE_SIZE - paginated.length) }).map((_, i) => (
              <div key={`filler-${i}`} className="px-4 py-[22px]" />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} className={safePage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-[12px] text-muted-foreground px-3 py-2 tabular-nums">{safePage} / {totalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={safePage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div><Label>Business Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name" /></div>
            <div><Label>Contact Name</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Primary contact" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.example.com" /></div>
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors">
                {SUPPLIER_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this supplier…" className="resize-none h-16 text-sm" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>{editing ? "Save Changes" : "Add Supplier"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
