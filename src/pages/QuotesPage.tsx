import { useState, useMemo, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Trash2, FileText, Download, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Quote, QuoteLineItem } from "@/lib/store";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<Quote["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/15 text-primary",
  accepted: "bg-success/15 text-success",
  declined: "bg-destructive/15 text-destructive",
};

export default function QuotesPage() {
  const { customers, services, quotes, addQuote, updateQuote, deleteQuote } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const printRef = useRef<HTMLDivElement>(null);

  // Form state
  const [isProspect, setIsProspect] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectAddress, setProspectAddress] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState("30");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(() => {
    let list = [...quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filterStatus !== "all") list = list.filter((q) => q.status === filterStatus);
    return list;
  }, [quotes, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetForm() {
    setIsProspect(false);
    setCustomerId("");
    setProspectName("");
    setProspectAddress("");
    setProspectPhone("");
    setProspectEmail("");
    setNotes("");
    setValidDays("30");
    setLineItems([]);
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { serviceId: "", serviceName: "", description: "", price: 0 }]);
  }

  function updateLineItem(idx: number, updates: Partial<QuoteLineItem>) {
    setLineItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  }

  function removeLineItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleServiceSelect(idx: number, serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    updateLineItem(idx, {
      serviceId: svc.id,
      serviceName: svc.name,
      description: svc.description,
      price: svc.defaultPrice,
    });
  }

  function handleSubmit() {
    const hasCustomer = isProspect ? prospectName.trim() : customerId;
    if (!hasCustomer || lineItems.length === 0) return;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays || "30"));
    addQuote({
      customerId: isProspect ? "" : customerId,
      ...(isProspect && {
        prospectName: prospectName.trim(),
        prospectAddress: prospectAddress.trim(),
        prospectPhone: prospectPhone.trim(),
        prospectEmail: prospectEmail.trim(),
      }),
      items: lineItems,
      notes,
      status: "draft",
      validUntil: validUntil.toISOString().slice(0, 10),
    });
    setDialogOpen(false);
    resetForm();
  }

  function getQuoteTotal(q: Quote) {
    return q.items.reduce((sum, item) => sum + item.price, 0);
  }

  function getQuoteCustomerName(q: Quote) {
    if (q.prospectName) return q.prospectName;
    return customerMap.get(q.customerId)?.name || "—";
  }

  function getQuoteCustomerDetails(q: Quote) {
    if (q.prospectName) {
      return { name: q.prospectName, address: q.prospectAddress || "" };
    }
    const c = customerMap.get(q.customerId);
    return { name: c?.name || "—", address: c?.address || "" };
  }

  function handlePrintPDF(quote: Quote) {
    const details = getQuoteCustomerDetails(quote);
    const total = getQuoteTotal(quote);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Quote - ${customer?.name || "Customer"}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #222; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #222; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand-icon { width: 48px; height: 48px; background: #e10098; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 20px; }
        .brand-name { font-size: 22px; font-weight: 700; }
        .brand-contact { font-size: 12px; color: #666; margin-top: 4px; line-height: 1.6; }
        .quote-title { font-size: 28px; font-weight: 700; color: #222; text-align: right; }
        .quote-ref { font-size: 12px; color: #888; text-align: right; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 32px; padding: 16px; background: #f7f7f7; border-radius: 6px; }
        .meta div { font-size: 13px; }
        .meta strong { display: block; font-size: 14px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 10px 12px; border-bottom: 2px solid #ddd; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .price { text-align: right; font-family: monospace; }
        .total-row td { border-top: 2px solid #222; font-weight: bold; font-size: 16px; }
        .notes { margin-top: 24px; padding: 16px; background: #fafafa; border-radius: 6px; font-size: 13px; color: #555; }
        .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
        <div class="header">
          <div class="brand">
            <div class="brand-icon">BL</div>
            <div>
              <div class="brand-name">Your Business Name</div>
              <div class="brand-contact">
                07700 000000 · hello@yourbusiness.co.uk<br/>
                123 Example Street, Your Town, AB1 2CD
              </div>
            </div>
          </div>
          <div>
            <div class="quote-title">QUOTE</div>
            <div class="quote-ref">Ref: ${quote.id.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Customer</strong>${customer?.name || "—"}<br/>${customer?.address || ""}</div>
          <div style="text-align:right"><strong>Date</strong>${formatDate(quote.createdAt)}<br/><strong>Valid Until</strong>${formatDate(quote.validUntil)}</div>
        </div>
        <table>
          <thead><tr><th>Service</th><th>Description</th><th class="price">Price</th></tr></thead>
          <tbody>
            ${quote.items.map((item) => `<tr><td>${item.serviceName}</td><td>${item.description}</td><td class="price">£${item.price.toFixed(2)}</td></tr>`).join("")}
            <tr class="total-row"><td colspan="2">Total</td><td class="price">£${total.toFixed(2)}</td></tr>
          </tbody>
        </table>
        ${quote.notes ? `<div class="notes"><strong>Notes:</strong> ${quote.notes}</div>` : ""}
        <div class="footer">Your Business Name · hello@yourbusiness.co.uk · 07700 000000</div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Quotes"
        description="Create and manage quotes for your customers"
        action={
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> New Quote
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        {["all", "draft", "sent", "accepted", "declined"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
              filterStatus === s
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {/* Quotes table */}
      <div className="surface rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="label-caps">Ref</TableHead>
              <TableHead className="label-caps">Customer</TableHead>
              <TableHead className="label-caps">Items</TableHead>
              <TableHead className="label-caps text-right">Total</TableHead>
              <TableHead className="label-caps">Status</TableHead>
              <TableHead className="label-caps">Date</TableHead>
              <TableHead className="label-caps text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No quotes yet — create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((q) => {
                const cust = customerMap.get(q.customerId);
                return (
                  <TableRow key={q.id} className="group border-border">
                    <TableCell className="mono text-xs">{q.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="font-medium">{cust?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{q.items.length} service{q.items.length !== 1 && "s"}</TableCell>
                    <TableCell className="text-right mono">{formatCurrency(getQuoteTotal(q))}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-[10px]", STATUS_STYLES[q.status])}>
                        {q.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Select
                          value={q.status}
                          onValueChange={(val) => updateQuote(q.id, { status: val as Quote["status"] })}
                        >
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewQuote(q)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintPDF(q)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteQuote(q.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-xs text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Create quote dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valid for (days)</Label>
                <Input type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Services</Label>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Service
                </Button>
              </div>

              {lineItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No services added yet. Click "Add Service" to begin.
                </p>
              )}

              {lineItems.map((item, idx) => (
                <div key={idx} className="surface rounded-lg p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Service</Label>
                      <Select
                        value={item.serviceId}
                        onValueChange={(val) => handleServiceSelect(idx, val)}
                      >
                        <SelectTrigger><SelectValue placeholder="Choose service" /></SelectTrigger>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28 space-y-1.5">
                      <Label className="text-xs">Price (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.price || ""}
                        onChange={(e) => updateLineItem(idx, { price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="mt-6 h-8 w-8 text-destructive"
                      onClick={() => removeLineItem(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                      placeholder="Service description"
                    />
                  </div>
                </div>
              ))}

              {lineItems.length > 0 && (
                <div className="flex justify-end pt-1">
                  <span className="text-sm font-medium">
                    Total: <span className="mono">{formatCurrency(lineItems.reduce((s, i) => s + i.price, 0))}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!customerId || lineItems.length === 0}>
                <FileText className="mr-1.5 h-4 w-4" /> Create Quote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewQuote} onOpenChange={() => setPreviewQuote(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quote Preview</DialogTitle>
          </DialogHeader>
          {previewQuote && (() => {
            const cust = customerMap.get(previewQuote.customerId);
            const total = getQuoteTotal(previewQuote);
            return (
              <div className="space-y-4 pt-2" ref={printRef}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{cust?.name}</p>
                    <p className="text-sm text-muted-foreground">{cust?.address}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Ref: {previewQuote.id.slice(0, 8).toUpperCase()}</p>
                    <p>{formatDate(previewQuote.createdAt)}</p>
                    <p>Valid until: {formatDate(previewQuote.validUntil)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="label-caps">Service</TableHead>
                      <TableHead className="label-caps">Description</TableHead>
                      <TableHead className="label-caps text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewQuote.items.map((item, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="font-medium">{item.serviceName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.description}</TableCell>
                        <TableCell className="text-right mono">{formatCurrency(item.price)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-foreground/20">
                      <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                      <TableCell className="text-right mono font-semibold">{formatCurrency(total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {previewQuote.notes && (
                  <div className="surface rounded-lg p-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Notes: </span>{previewQuote.notes}
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => handlePrintPDF(previewQuote)}>
                    <Download className="mr-1.5 h-4 w-4" /> Download PDF
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
