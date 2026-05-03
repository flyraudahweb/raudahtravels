import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Building2, Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
  isActive: boolean;
  createdAt: string;
}

const BASE = "/api";

async function fetchAccounts(): Promise<{ accounts: BankAccount[] }> {
  const r = await fetch(`${BASE}/admin/bank-accounts`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function createAccount(data: Partial<BankAccount>): Promise<BankAccount> {
  const r = await fetch(`${BASE}/admin/bank-accounts`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create");
  return r.json();
}

async function updateAccount(id: string, data: Partial<BankAccount>): Promise<BankAccount> {
  const r = await fetch(`${BASE}/admin/bank-accounts/${id}`, {
    method: "PUT", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

async function deleteAccount(id: string): Promise<void> {
  const r = await fetch(`${BASE}/admin/bank-accounts/${id}`, {
    method: "DELETE", credentials: "include",
  });
  if (!r.ok) throw new Error("Failed to delete");
}

const EMPTY = { bankName: "", accountName: "", accountNumber: "", sortCode: "", isActive: true };

export default function AdminBankAccounts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({ queryKey: ["admin-bank-accounts"], queryFn: fetchAccounts });
  const accounts = data?.accounts || [];

  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bank-accounts"] }); toast({ title: "Account added" }); setOpen(false); setForm(EMPTY); },
    onError: () => toast({ title: "Failed to add account", variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAccount(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bank-accounts"] }); toast({ title: "Account updated" }); setOpen(false); setEditing(null); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bank-accounts"] }); toast({ title: "Account deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (a: BankAccount) => { setEditing(a); setForm({ bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, sortCode: a.sortCode || "", isActive: a.isActive }); setOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) update.mutate({ id: editing.id, data: form });
    else create.mutate(form);
  };

  const toggleActive = (a: BankAccount) => {
    update.mutate({ id: a.id, data: { isActive: !a.isActive } });
  };

  return (
    <div className="space-y-6" data-testid="page-admin-bank-accounts">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Finance</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Bank Accounts</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Manage company accounts shown to pilgrims for payment</p>
        </div>
        <Button onClick={openNew} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">{[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-[#DCE3F0]" />
        ))}</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE3F0] p-12 text-center">
          <Building2 className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
          <p className="font-bold text-[#64748B]">No bank accounts yet</p>
          <p className="text-sm text-[#94A3B8] mt-1">Add a company account for pilgrims to transfer payments to</p>
          <Button onClick={openNew} className="mt-4 bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Add First Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-[#DCE3F0] p-5 flex items-center gap-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${a.isActive ? "bg-[#EEF0FF]" : "bg-[#F1F5F9]"}`}>
                <Building2 className={`w-6 h-6 ${a.isActive ? "text-[#2D3199]" : "text-[#94A3B8]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-black text-[#0F172A] text-base">{a.bankName}</h3>
                  {a.isActive ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Active</span>
                  ) : (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-[#475569] font-semibold">{a.accountName}</p>
                <p className="text-sm text-[#64748B] font-mono">{a.accountNumber}{a.sortCode ? ` · ${a.sortCode}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {a.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}
                  <Switch checked={a.isActive} onCheckedChange={() => toggleActive(a)} />
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(a)} className="w-9 h-9 rounded-xl hover:bg-[#EEF0FF] hover:text-[#2D3199]">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(a.id)} className="w-9 h-9 rounded-xl hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#0F172A]">{editing ? "Edit Account" : "Add Bank Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Bank Name</Label>
              <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. First Bank Nigeria" required className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Account Name</Label>
              <Input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} placeholder="e.g. Raudah Travels Ltd" required className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Account Number</Label>
              <Input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="0123456789" required className="mt-1 rounded-xl font-mono" />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Sort Code / Branch (optional)</Label>
              <Input value={form.sortCode} onChange={e => setForm(f => ({ ...f, sortCode: e.target.value }))} placeholder="058" className="mt-1 rounded-xl" />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label className="text-sm font-semibold text-[#475569]">Show to pilgrims (Active)</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} className="flex-1 bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl">
                {editing ? "Save Changes" : "Add Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
