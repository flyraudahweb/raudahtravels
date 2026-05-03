import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput, Plus, GripVertical, Trash2, Eye, EyeOff, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormField {
  id: string;
  label: string;
  fieldName: string;
  fieldType: string;
  placeholder?: string;
  required: boolean;
  appliesTo: string;
  section: string;
  enabled: boolean;
  isSystem: boolean;
  sortOrder: number;
  options?: string[];
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long Text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "file_upload", label: "File Upload" },
  { value: "checkbox", label: "Checkbox" },
];

const SECTIONS = [
  { value: "pilgrim_info", label: "Pilgrim Information" },
  { value: "travel", label: "Travel Preferences" },
  { value: "emergency", label: "Emergency Contact" },
  { value: "medical", label: "Medical Information" },
  { value: "documents", label: "Documents" },
];

const APPLIES_TO = [
  { value: "all", label: "Everyone" },
  { value: "admin", label: "Admin Only" },
  { value: "user", label: "User Only" },
];

const SECTION_COLORS: Record<string, string> = {
  pilgrim_info: "bg-blue-50 text-blue-700 border-blue-200",
  travel: "bg-indigo-50 text-indigo-700 border-indigo-200",
  emergency: "bg-amber-50 text-amber-700 border-amber-200",
  medical: "bg-red-50 text-red-700 border-red-200",
  documents: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

async function api(path: string, opts?: RequestInit) {
  const r = await fetch(`/api${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error("API error");
  return r.json();
}

const EMPTY_FIELD = { label: "", fieldName: "", fieldType: "text", placeholder: "", required: false, appliesTo: "all", section: "pilgrim_info", options: "" };

export default function AdminBookingForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FIELD);
  const [filterSection, setFilterSection] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-booking-form-fields"],
    queryFn: () => api("/admin/booking-form-fields"),
  });
  const fields: FormField[] = data?.fields || [];

  const filteredFields = filterSection === "all" ? fields : fields.filter(f => f.section === filterSection);
  const systemFields = filteredFields.filter(f => f.isSystem);
  const customFields = filteredFields.filter(f => !f.isSystem);

  const toggleField = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api(`/admin/booking-form-fields/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-booking-form-fields"] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const toggleRequired = useMutation({
    mutationFn: ({ id, required }: { id: string; required: boolean }) =>
      api(`/admin/booking-form-fields/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ required }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-booking-form-fields"] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const createField = useMutation({
    mutationFn: (data: any) => api("/admin/booking-form-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-booking-form-fields"] }); toast({ title: "Field added" }); setOpen(false); setForm(EMPTY_FIELD); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const deleteField = useMutation({
    mutationFn: (id: string) => api(`/admin/booking-form-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-booking-form-fields"] }); toast({ title: "Field deleted" }); },
    onError: () => toast({ title: "Cannot delete system fields", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      fieldName: form.fieldName || form.label.toLowerCase().replace(/\s+/g, "_"),
      options: form.fieldType === "select" && form.options ? form.options.split(",").map(s => s.trim()) : undefined,
    };
    createField.mutate(payload);
  };

  const systemCount = fields.filter(f => f.isSystem && f.enabled).length;
  const customCount = fields.filter(f => !f.isSystem && f.enabled).length;

  return (
    <div className="space-y-6" data-testid="page-admin-booking-form">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Configuration</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Booking Form Builder</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Configure which fields appear on the pilgrim booking form</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Custom Field
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Fields", value: fields.length, color: "text-[#2D3199]" },
          { label: "System Fields Enabled", value: systemCount, color: "text-blue-600" },
          { label: "Custom Fields", value: customCount, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#DCE3F0] p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[#64748B] mt-0.5 font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={filterSection === "all" ? "default" : "outline"} onClick={() => setFilterSection("all")} className={`rounded-xl text-xs ${filterSection === "all" ? "bg-[#2D3199] text-white" : "border-[#DCE3F0]"}`}>All</Button>
        {SECTIONS.map(s => (
          <Button key={s.value} size="sm" variant={filterSection === s.value ? "default" : "outline"} onClick={() => setFilterSection(s.value)} className={`rounded-xl text-xs ${filterSection === s.value ? "bg-[#2D3199] text-white" : "border-[#DCE3F0]"}`}>{s.label}</Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-[#DCE3F0]" />)}</div>
      ) : (
        <>
          {systemFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />
                <p className="text-xs font-black text-[#64748B] uppercase tracking-widest">System Fields</p>
              </div>
              <div className="space-y-2">
                {systemFields.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl border border-[#DCE3F0] px-5 py-3.5 flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[#0F172A] text-sm">{f.label}</span>
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-bold capitalize ${SECTION_COLORS[f.section] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{f.section?.replace("_", " ")}</span>
                        {f.required && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">Required</span>}
                      </div>
                      <p className="text-xs text-[#94A3B8] font-mono">{f.fieldName} · {f.fieldType}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider">Required</span>
                        <Switch checked={f.required} onCheckedChange={v => toggleRequired.mutate({ id: f.id, required: v })} />
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider">Visible</span>
                        <div className="flex items-center gap-1.5">
                          {f.enabled ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-[#CBD5E1]" />}
                          <Switch checked={f.enabled} onCheckedChange={v => toggleField.mutate({ id: f.id, enabled: v })} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-3.5 h-3.5 text-[#94A3B8]" />
                <p className="text-xs font-black text-[#64748B] uppercase tracking-widest">Custom Fields</p>
              </div>
              <div className="space-y-2">
                {customFields.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl border border-[#DCE3F0] px-5 py-3.5 flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[#0F172A] text-sm">{f.label}</span>
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-bold capitalize ${SECTION_COLORS[f.section] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{f.section?.replace("_", " ")}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold">Custom</span>
                        {f.required && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">Required</span>}
                      </div>
                      <p className="text-xs text-[#94A3B8] font-mono">{f.fieldName} · {f.fieldType} · {f.appliesTo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={f.enabled} onCheckedChange={v => toggleField.mutate({ id: f.id, enabled: v })} />
                      <Button size="icon" variant="ghost" onClick={() => deleteField.mutate(f.id)} className="w-9 h-9 rounded-xl hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredFields.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#DCE3F0] p-12 text-center">
              <FormInput className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#64748B]">No fields found</p>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-black text-[#0F172A]">Add Custom Field</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Field Label</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Dietary Requirements" required className="mt-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Field Type</Label>
                <Select value={form.fieldType} onValueChange={v => setForm(f => ({ ...f, fieldType: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Section</Label>
                <Select value={form.section} onValueChange={v => setForm(f => ({ ...f, section: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Placeholder</Label>
              <Input value={form.placeholder} onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            {form.fieldType === "select" && (
              <div>
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Options (comma-separated)</Label>
                <Input value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))} placeholder="Option 1, Option 2, Option 3" className="mt-1 rounded-xl" />
              </div>
            )}
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Visible To</Label>
              <Select value={form.appliesTo} onValueChange={v => setForm(f => ({ ...f, appliesTo: v }))}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{APPLIES_TO.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} />
              <Label className="text-sm font-semibold text-[#475569]">Required field</Label>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" disabled={createField.isPending} className="flex-1 bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl">Add Field</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
