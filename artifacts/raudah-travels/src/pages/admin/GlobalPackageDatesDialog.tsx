import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListPackageDates, 
  getListPackageDatesQueryKey,
  useCreatePackageDate,
  useUpdatePackageDate,
  useDeletePackageDate,
  getListPackagesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plane, Plus, Trash2, Edit2, Loader2, X } from "lucide-react";

type DateForm = {
  id?: string;
  outbound: string;
  outboundRoute: string;
  returnDate: string;
  returnRoute: string;
  airline: string;
  islamicDate: string;
  islamicReturnDate: string;
};

const emptyForm: DateForm = {
  outbound: "",
  outboundRoute: "KANO-JEDDAH",
  returnDate: "",
  returnRoute: "JEDDAH-KANO",
  airline: "flyadeal",
  islamicDate: "",
  islamicReturnDate: "",
};

export function GlobalPackageDatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: datesResp, isLoading } = useListPackageDates(
    { query: { enabled: open } }
  );
  
  const createDate = useCreatePackageDate();
  const updateDate = useUpdatePackageDate();
  const deleteDate = useDeletePackageDate();
  
  const [form, setForm] = useState<DateForm | null>(null);

  const dates = datesResp?.dates || [];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const data = {
      outbound: form.outbound,
      outboundRoute: form.outboundRoute || "",
      returnDate: form.returnDate || "",
      returnRoute: form.returnRoute || "",
      airline: form.airline || "",
      islamicDate: form.islamicDate || "",
      islamicReturnDate: form.islamicReturnDate || "",
    };

    const opts = {
      onSuccess: () => {
        toast({ title: form.id ? "Schedule updated" : "Schedule added" });
        qc.invalidateQueries({ queryKey: getListPackageDatesQueryKey() });
        qc.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        setForm(null);
      },
      onError: () => toast({ title: "Failed to save schedule", variant: "destructive" as const }),
    };

    if (form.id) {
      updateDate.mutate({ id: form.id, data }, opts);
    } else {
      createDate.mutate({ data }, opts);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this flight schedule?")) return;
    deleteDate.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Schedule deleted" });
        qc.invalidateQueries({ queryKey: getListPackageDatesQueryKey() });
        qc.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" as const }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl p-0">
        <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
          <div>
            <DialogTitle className="font-black text-[#0F172A] text-xl flex items-center gap-2">
              <Plane className="w-5 h-5 text-[#2D3199]" /> Global Flight Schedules
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold ml-2">Beta</span>
            </DialogTitle>
            <p className="text-sm text-[#64748B] mt-1">These dates will automatically appear on all Umrah packages.</p>
          </div>
          {!form && (
            <button onClick={() => setForm(emptyForm)} className="flex items-center gap-2 px-4 py-2 bg-[#2D3199] hover:bg-[#1f2277] text-white rounded-xl font-bold transition-colors">
              <Plus className="w-4 h-4" /> Add Date
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          {form ? (
            <form onSubmit={handleSave} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-[#0F172A]">{form.id ? "Edit Schedule" : "New Schedule"}</h3>
                <button type="button" onClick={() => setForm(null)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Departure City / Route Preset</Label>
                  <Select 
                    value={
                      form.outboundRoute === "KANO-JEDDAH" && form.returnRoute === "JEDDAH-KANO" ? "kano" : 
                      form.outboundRoute === "ABUJA-MADINAH" && form.returnRoute === "MADINAH-ABUJA" ? "abuja" : 
                      "custom"
                    } 
                    onValueChange={(val) => {
                      if (val === "kano") setForm({ ...form, outboundRoute: "KANO-JEDDAH", returnRoute: "JEDDAH-KANO", airline: "flyadeal" });
                      else if (val === "abuja") setForm({ ...form, outboundRoute: "ABUJA-MADINAH", returnRoute: "MADINAH-ABUJA", airline: "EGYPTAIR" });
                      else setForm({ ...form, outboundRoute: "", returnRoute: "", airline: "" });
                    }}
                  >
                    <SelectTrigger className="rounded-xl h-10">
                      <SelectValue placeholder="Select Route Preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kano">Kano (KANO-JEDDAH via flyadeal)</SelectItem>
                      <SelectItem value="abuja">Abuja (ABUJA-MADINAH via EGYPTAIR)</SelectItem>
                      <SelectItem value="custom">Custom Route...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Outbound Date</Label>
                  <Input type="date" value={form.outbound} onChange={e => setForm({ ...form, outbound: e.target.value })} required className="rounded-xl h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Return Date</Label>
                  <Input type="date" value={form.returnDate} onChange={e => setForm({ ...form, returnDate: e.target.value })} className="rounded-xl h-10" />
                </div>

                {(form.outboundRoute !== "KANO-JEDDAH" || form.returnRoute !== "JEDDAH-KANO") && 
                 (form.outboundRoute !== "ABUJA-MADINAH" || form.returnRoute !== "MADINAH-ABUJA") && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Outbound Route</Label>
                      <Input placeholder="e.g. LAGOS-JEDDAH" value={form.outboundRoute} onChange={e => setForm({ ...form, outboundRoute: e.target.value })} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Return Route</Label>
                      <Input placeholder="e.g. JEDDAH-LAGOS" value={form.returnRoute} onChange={e => setForm({ ...form, returnRoute: e.target.value })} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Airline</Label>
                      <Input placeholder="e.g. EGYPTAIR" value={form.airline} onChange={e => setForm({ ...form, airline: e.target.value })} className="rounded-xl h-10" />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Islamic Outbound (opt)</Label>
                  <Input placeholder="e.g. 1 Muharram" value={form.islamicDate} onChange={e => setForm({ ...form, islamicDate: e.target.value })} className="rounded-xl h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Islamic Return (opt)</Label>
                  <Input placeholder="e.g. 15 Muharram" value={form.islamicReturnDate} onChange={e => setForm({ ...form, islamicReturnDate: e.target.value })} className="rounded-xl h-10" />
                </div>

                <div className="flex items-end md:col-start-4">
                  <Button type="submit" className="w-full h-10 rounded-xl bg-[#FF3B00] hover:bg-[#e03500] font-bold shadow-md shadow-[#FF3B00]/20" disabled={createDate.isPending || updateDate.isPending}>
                    {createDate.isPending || updateDate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Schedule"}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-[#2D3199] animate-spin" /></div>
          ) : dates.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Plane className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <p className="font-bold">No global flight schedules yet.</p>
              <p className="text-sm mt-1">Add dates here and they will be available on all Umrah packages.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-black text-[#64748B] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Departure</th>
                    <th className="px-5 py-3">Return</th>
                    <th className="px-5 py-3">Airline</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {[...dates].sort((a: any, b: any) => new Date(a.outbound).getTime() - new Date(b.outbound).getTime()).map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-bold text-[#0F172A]">{new Date(d.outbound).toLocaleDateString('en-GB')}</div>
                        <div className="text-xs text-[#64748B]">{d.outboundRoute}</div>
                        {d.islamicDate && <div className="text-[10px] text-amber-600 bg-amber-50 inline-block px-1.5 rounded mt-0.5">{d.islamicDate}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-bold text-[#0F172A]">{d.returnDate ? new Date(d.returnDate).toLocaleDateString('en-GB') : '-'}</div>
                        <div className="text-xs text-[#64748B]">{d.returnRoute}</div>
                        {d.islamicReturnDate && <div className="text-[10px] text-amber-600 bg-amber-50 inline-block px-1.5 rounded mt-0.5">{d.islamicReturnDate}</div>}
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#334155]">
                        {d.airline || '-'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setForm({
                            id: d.id,
                            outbound: d.outbound,
                            outboundRoute: d.outboundRoute || "",
                            returnDate: d.returnDate || "",
                            returnRoute: d.returnRoute || "",
                            airline: d.airline || "",
                            islamicDate: d.islamicDate || "",
                            islamicReturnDate: d.islamicReturnDate || ""
                          })} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors" disabled={deleteDate.isPending}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
