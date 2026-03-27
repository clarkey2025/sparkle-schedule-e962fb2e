import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, Users, Phone, Mail, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { TeamMember, TeamRole } from "@/lib/store";

const PAGE_SIZE = 5;

const ROLE_META: Record<TeamRole, { label: string; class: string }> = {
  owner: { label: "Owner", class: "bg-primary/15 text-primary" },
  manager: { label: "Manager", class: "bg-warning/15 text-warning" },
  cleaner: { label: "Cleaner", class: "bg-success/15 text-success" },
};

const TEAM_COLOURS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#EC4899"];

const SKILL_OPTIONS = [
  { id: "window-cleaning", label: "Window Cleaning" },
  { id: "gutter-cleaning", label: "Gutter Cleaning" },
  { id: "soffit-fascia", label: "Soffit & Fascia" },
  { id: "jet-washing", label: "Jet Washing" },
  { id: "caravan-cleaning", label: "Caravan Cleaning" },
];

type FormState = {
  name: string; phone: string; email: string; role: TeamRole;
  skills: string[]; colour: string; active: boolean; hourlyRate: number;
};

const emptyForm: FormState = {
  name: "", phone: "", email: "", role: "cleaner",
  skills: [], colour: "#3B82F6", active: true, hourlyRate: 0,
};

export default function TeamPage() {
  const { teamMembers, jobs, addTeamMember, updateTeamMember, deleteTeamMember } = useApp();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setForm({ name: m.name, phone: m.phone, email: m.email, role: m.role, skills: m.skills, colour: m.colour, active: m.active, hourlyRate: m.hourlyRate || 0 });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      updateTeamMember(editing.id, form);
      toast({ title: "Team member updated", description: form.name });
    } else {
      addTeamMember(form);
      toast({ title: "Team member added", description: form.name });
    }
    setDialogOpen(false);
  };

  const toggleSkill = (skillId: string) => {
    setForm((f) => ({ ...f, skills: f.skills.includes(skillId) ? f.skills.filter((s) => s !== skillId) : [...f.skills, skillId] }));
  };

  const filtered = useMemo(() => {
    let list = teamMembers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role.includes(q));
    }
    return list;
  }, [teamMembers, search]);

  const active = filtered.filter((m) => m.active);
  const inactive = filtered.filter((m) => !m.active);
  const allMembers = [...active, ...inactive];

  const totalPages = Math.max(1, Math.ceil(allMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = allMembers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount = teamMembers.filter((m) => m.active).length;
  const inactiveCount = teamMembers.filter((m) => !m.active).length;

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Team"
        description={`${activeCount} active member${activeCount !== 1 ? "s" : ""}${inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ""}`}
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
          </Button>
        }
      />

      {teamMembers.length > 0 && (
        <div className="relative max-w-xs animate-fade-up">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search team…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      )}

      {paginated.length === 0 ? (
        <EmptyState icon={Users} message={teamMembers.length === 0 ? "No team members yet — add your first one." : "No results found."} className="animate-fade-up" />
      ) : (
        <div className="space-y-3 animate-fade-up">
          <div className="surface rounded-md overflow-hidden divide-y divide-border">
            {paginated.map((member) => {
              const assignedJobs = jobs.filter((j) => j.assignedTo === member.id && j.status === "scheduled").length;
              const isInactive = !member.active;
              return (
                <div key={member.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group", isInactive && "opacity-50")}>
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-medium text-white shrink-0"
                    style={{ backgroundColor: member.colour + (isInactive ? "60" : "") }}
                  >
                    {member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{member.name}</span>
                      <Badge variant="secondary" className={cn("text-[10px] uppercase tracking-wider", ROLE_META[member.role].class)}>
                        {ROLE_META[member.role].label}
                      </Badge>
                      {isInactive && <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">INACTIVE</Badge>}
                      {assignedJobs > 0 && <span className="text-[10px] text-muted-foreground font-mono">{assignedJobs} jobs</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[12px] text-muted-foreground">
                      {member.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                      {member.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</span>}
                    </div>
                    {member.skills.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {member.skills.map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                            {SKILL_OPTIONS.find((o) => o.id === s)?.label || s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {member.hourlyRate ? <span className="font-mono text-sm text-foreground mr-2">£{member.hourlyRate}/hr</span> : null}
                    <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(member)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => { deleteTeamMember(member.id); toast({ title: "Member removed", description: member.name }); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Filler rows */}
            {Array.from({ length: Math.max(0, PAGE_SIZE - paginated.length) }).map((_, i) => (
              <div key={`filler-${i}`} className="px-4 py-[22px]" />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, allMembers.length)} of {allMembers.length}
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
          <DialogHeader><DialogTitle>{editing ? "Edit Team Member" : "Add Team Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07700 000000" /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@email.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as TeamRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hourly Rate (£)</Label>
                <Input type="number" min={0} step={0.5} value={form.hourlyRate || ""} onChange={(e) => setForm({ ...form, hourlyRate: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Skills</Label>
              <div className="grid grid-cols-2 gap-2">
                {SKILL_OPTIONS.map((skill) => (
                  <label key={skill.id} className="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
                    <Checkbox checked={form.skills.includes(skill.id)} onCheckedChange={() => toggleSkill(skill.id)} />
                    {skill.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Colour</Label>
              <div className="flex gap-2 flex-wrap">
                {TEAM_COLOURS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, colour: c })} className={cn("h-7 w-7 rounded-full transition-all", form.colour === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : "hover:scale-105 opacity-70 hover:opacity-100")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />
                Active team member
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>{editing ? "Save Changes" : "Add Member"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
