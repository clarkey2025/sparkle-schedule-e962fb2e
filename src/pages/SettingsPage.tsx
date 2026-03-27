import { useState, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Upload, X } from "lucide-react";

export default function SettingsPage() {
  const { businessSettings, updateBusinessSettings } = useApp();
  const [form, setForm] = useState({ ...businessSettings });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    updateBusinessSettings(form);
    toast({ title: "Settings saved", description: "Your business details have been updated." });
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setForm((f) => ({ ...f, logoUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="pb-20 md:pb-0 space-y-5 animate-fade-up">
      <PageHeader
        title="Settings"
        description="Manage your business details — these appear on quotes and invoices"
        action={
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1.5 h-4 w-4" /> Save Changes
          </Button>
        }
      />

      <div className="surface rounded-md p-6 max-w-2xl space-y-5">
        {/* Logo */}
        <div className="space-y-2">
          <Label>Business Logo</Label>
          <div className="flex items-center gap-4">
            {form.logoUrl ? (
              <div className="relative">
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg object-contain border border-border bg-muted/30 p-1"
                />
                <button
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                <Upload className="h-5 w-5" />
              </div>
            )}
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {form.logoUrl ? "Change Logo" : "Upload Logo"}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG or SVG. Max 2MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </div>

        {/* Business Name */}
        <div className="space-y-1.5">
          <Label>Business Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Your Business Name"
          />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="07700 000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="hello@yourbusiness.co.uk"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="123 Example Street, Your Town, AB1 2CD"
          />
        </div>

        {/* Preview */}
        <div className="pt-4 border-t border-border">
          <p className="label-caps mb-3">Quote Header Preview</p>
          <div className="rounded-lg border border-border bg-white p-4 text-black">
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain" />
              ) : (
                <div className="h-10 w-10 rounded bg-[#e10098] flex items-center justify-center text-white font-medium text-sm">
                  {form.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "BL"}
                </div>
              )}
              <div>
                <p className="font-medium text-sm">{form.name || "Your Business Name"}</p>
                <p className="text-[11px] text-gray-500">
                  {form.phone} · {form.email}
                  <br />
                  {form.address}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
