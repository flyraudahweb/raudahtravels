import { useState, useRef, useCallback, useEffect } from "react";
import {
  Download, Upload, History, Shield, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Database, FileJson, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Clock, HardDrive, Table2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface TableDef { key: string; label: string; group: string }
interface BackupMeta {
  version: string; app: string; exportedAt: string; exportedByName: string;
  label: string; totalTables: number; totalRecords: number;
  tableStats: Record<string, number>; checksum: string; errors?: string[];
}
interface HistoryRow {
  id: string; filename: string; label: string | null; type: string; status: string;
  sizeBytes: number | null; tablesIncluded: string[] | null;
  totalRecords: number | null; tableStats: Record<string, number> | null;
  checksum: string | null; notes: string | null; createdAt: string;
  createdByName: string | null;
}
interface DryRunResult {
  dryRun: true; valid: boolean; checksumValid: boolean; meta: BackupMeta;
  tableSummary: { table: string; records: number }[]; totalRecords: number;
}
interface ImportResult {
  success: boolean; mode: string; tablesRestored: number;
  totalRecords: number; tableStats: Record<string, number>;
  warnings: string[]; meta: BackupMeta;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partial:   { label: "Partial",   className: "bg-amber-50 text-amber-700 border-amber-200" },
    failed:    { label: "Failed",    className: "bg-red-50 text-red-700 border-red-200" },
  };
  const s = map[status] || { label: status, className: "bg-gray-50 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.className}`}>
      {s.label}
    </span>
  );
}

/* ── Fetchers ───────────────────────────────────────────────────────────────── */

async function fetchTableDefs(): Promise<{ tables: TableDef[] }> {
  const r = await fetch("/api/admin/backup/tables", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load table list");
  return r.json();
}

async function fetchHistory(): Promise<{ history: HistoryRow[] }> {
  const r = await fetch("/api/admin/backup/history", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load history");
  return r.json();
}

/* ── Export Section ────────────────────────────────────────────────────────── */

function ExportSection({ tables }: { tables: TableDef[] }) {
  const [label, setLabel] = useState("");
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(tables.map(t => t.key)));

  useEffect(() => {
    if (tables.length > 0) setSelected(new Set(tables.map(t => t.key)));
  }, [tables]);

  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<{ filename: string; size: string } | null>(null);
  const queryClient = useQueryClient();

  const groups = [...new Set(tables.map(t => t.group))];

  const toggleAll = () => {
    if (selected.size === tables.length) setSelected(new Set());
    else setSelected(new Set(tables.map(t => t.key)));
  };
  const toggleGroup = (group: string) => {
    const groupKeys = tables.filter(t => t.group === group).map(t => t.key);
    const allIn = groupKeys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      if (allIn) groupKeys.forEach(k => next.delete(k));
      else groupKeys.forEach(k => next.add(k));
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    setLastResult(null);
    try {
      const r = await fetch("/api/admin/backup/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: selected.size === tables.length ? undefined : Array.from(selected),
          label: label.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        alert(`Export failed: ${d.error}`);
        return;
      }
      const blob = await r.blob();
      const disposition = r.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `raudah-backup-${Date.now()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setLastResult({ filename, size: formatBytes(blob.size) });
      queryClient.invalidateQueries({ queryKey: ["backup-history"] });
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-[#2D3199]" />
          </div>
          <div>
            <h2 className="font-bold text-[#0F172A] text-base">Create Backup</h2>
            <p className="text-sm text-[#64748B]">Export all data to a portable JSON backup file</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Label */}
        <div>
          <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">
            Backup Label <span className="font-normal text-[#94A3B8] normal-case">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Before migration, Monthly Jan 2026…"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#DCE3F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199] transition-all"
          />
        </div>

        {/* Table selector */}
        <div>
          <button
            onClick={() => setShowTablePicker(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-[#64748B] uppercase tracking-wide hover:text-[#2D3199] transition-colors"
          >
            <Table2 className="w-3.5 h-3.5" />
            {selected.size === tables.length
              ? `All ${tables.length} tables`
              : `${selected.size} / ${tables.length} tables selected`}
            {showTablePicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTablePicker && (
            <div className="mt-3 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">Select tables to include in backup</span>
                <button onClick={toggleAll} className="text-xs font-semibold text-[#2D3199] hover:underline">
                  {selected.size === tables.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              {groups.map(group => {
                const groupTables = tables.filter(t => t.group === group);
                const allIn = groupTables.every(t => selected.has(t.key));
                const someIn = groupTables.some(t => selected.has(t.key));
                return (
                  <div key={group}>
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={allIn}
                        className={someIn && !allIn ? "opacity-50" : ""}
                        onCheckedChange={() => toggleGroup(group)}
                      />
                      <span className="text-xs font-black text-[#334155] uppercase tracking-wide">{group}</span>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-1">
                      {groupTables.map(t => (
                        <label key={t.key} className="flex items-center gap-2 cursor-pointer group">
                          <Checkbox
                            checked={selected.has(t.key)}
                            onCheckedChange={checked => {
                              setSelected(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(t.key);
                                else next.delete(t.key);
                                return next;
                              });
                            }}
                          />
                          <span className="text-xs text-[#64748B] group-hover:text-[#0F172A] transition-colors truncate">
                            {t.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info row */}
        <div className="flex items-start gap-2 p-3 bg-[#F0F9FF] rounded-xl border border-[#BAE6FD]">
          <Info className="w-4 h-4 text-[#0EA5E9] shrink-0 mt-0.5" />
          <p className="text-xs text-[#0369A1]">
            The backup file is a signed JSON document with a SHA-256 checksum.
            It can be imported to restore or migrate this system.
          </p>
        </div>

        {/* Success */}
        {lastResult && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700">
              <span className="font-semibold">Downloaded:</span> {lastResult.filename} ({lastResult.size})
            </p>
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={exporting || selected.size === 0}
          className="w-full bg-[#2D3199] hover:bg-[#252882] text-white font-bold rounded-xl h-11"
        >
          {exporting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating backup…</>
          ) : (
            <><Download className="w-4 h-4 mr-2" /> Export & Download Backup</>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ── Import Section ─────────────────────────────────────────────────────────── */

function ImportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<"upsert" | "skip">("upsert");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState<"dryrun" | "import" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setFile(null); setDryRunResult(null); setImportResult(null);
    setErrorMsg(null); setLoading(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".json")) { setFile(f); setDryRunResult(null); setImportResult(null); setErrorMsg(null); }
    else setErrorMsg("Please drop a .json backup file");
  }, []);

  const runDryRun = async () => {
    if (!file) return;
    setLoading("dryrun"); setErrorMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dryRun", "true");
      form.append("mode", mode);
      const r = await fetch("/api/admin/backup/import", { method: "POST", credentials: "include", body: form });
      const d = await r.json();
      if (!r.ok) { setErrorMsg(d.error); return; }
      setDryRunResult(d);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(null);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setConfirmOpen(false);
    setLoading("import"); setErrorMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dryRun", "false");
      form.append("mode", mode);
      const r = await fetch("/api/admin/backup/import", { method: "POST", credentials: "include", body: form });
      const d = await r.json();
      if (!r.ok) { setErrorMsg(d.error); return; }
      setImportResult(d);
      queryClient.invalidateQueries({ queryKey: ["backup-history"] });
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-[#0F172A] text-base">Restore from Backup</h2>
              <p className="text-sm text-[#64748B]">Upload a backup file to restore or merge data</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
                ${dragging ? "border-[#2D3199] bg-[#EEF0FF]" : "border-[#DCE3F0] hover:border-[#2D3199]/40 hover:bg-[#F8FAFF]"}`}
            >
              <FileJson className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <p className="font-semibold text-[#334155] text-sm">Drop your backup file here</p>
              <p className="text-xs text-[#94A3B8] mt-1">or click to browse — .json backup files only</p>
              <input ref={fileRef} type="file" accept=".json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setDryRunResult(null); setImportResult(null); setErrorMsg(null); } }} />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF]">
              <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                <FileJson className="w-5 h-5 text-[#2D3199]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{file.name}</p>
                <p className="text-xs text-[#94A3B8]">{formatBytes(file.size)}</p>
              </div>
              <button onClick={reset} className="p-1.5 rounded-lg hover:bg-[#E2E8F0] text-[#94A3B8] hover:text-[#334155] transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Dry run result */}
          {dryRunResult && !importResult && (
            <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-[#0F172A]">Backup Preview</span>
                <span className="ml-auto text-xs text-[#64748B]">{dryRunResult.totalRecords.toLocaleString()} records</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2.5 border border-[#E2E8F0]">
                  <p className="text-[#94A3B8] mb-0.5">Exported</p>
                  <p className="font-semibold text-[#0F172A]">{formatDate(dryRunResult.meta.exportedAt)}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-[#E2E8F0]">
                  <p className="text-[#94A3B8] mb-0.5">By</p>
                  <p className="font-semibold text-[#0F172A] truncate">{dryRunResult.meta.exportedByName}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-[#E2E8F0]">
                  <p className="text-[#94A3B8] mb-0.5">Integrity</p>
                  <p className={`font-bold ${dryRunResult.checksumValid ? "text-emerald-600" : "text-red-600"}`}>
                    {dryRunResult.checksumValid ? "✓ Valid" : "✗ Tampered"}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-[#E2E8F0]">
                  <p className="text-[#94A3B8] mb-0.5">Tables</p>
                  <p className="font-semibold text-[#0F172A]">{dryRunResult.tableSummary.length}</p>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {dryRunResult.tableSummary.map(t => (
                  <div key={t.table} className="flex items-center justify-between text-xs px-1">
                    <span className="text-[#64748B] font-mono">{t.table}</span>
                    <span className="font-semibold text-[#334155]">{t.records.toLocaleString()} rows</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-800">Restore Complete</span>
              </div>
              <p className="text-xs text-emerald-700">
                {importResult.tablesRestored} tables · {importResult.totalRecords.toLocaleString()} records restored
                ({importResult.mode === "upsert" ? "merged" : "skipped duplicates"})
              </p>
              {importResult.warnings.length > 0 && (
                <div className="space-y-1 pt-1">
                  {importResult.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-700 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Import mode */}
          {file && !importResult && (
            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                Conflict Resolution
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "upsert", label: "Merge (recommended)", desc: "Overwrite existing records with backup data" },
                  { value: "skip",   label: "Skip duplicates",      desc: "Keep existing records, only add missing ones" },
                ] as const).map(opt => (
                  <label key={opt.value}
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all
                      ${mode === opt.value ? "border-[#2D3199] bg-[#EEF0FF]" : "border-[#E2E8F0] bg-white hover:border-[#2D3199]/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center
                        ${mode === opt.value ? "border-[#2D3199]" : "border-[#CBD5E1]"}`}>
                        {mode === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-[#2D3199]" />}
                      </div>
                      <input type="radio" name="mode" value={opt.value} checked={mode === opt.value}
                        onChange={() => setMode(opt.value)} className="sr-only" />
                      <span className="text-xs font-bold text-[#334155]">{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] ml-5">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          {file && !importResult && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Restoring will modify live data. Always run a <strong>Test Run</strong> first to preview changes
                before committing the restore.
              </p>
            </div>
          )}

          {/* Action buttons */}
          {file && !importResult && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={runDryRun}
                disabled={!!loading}
                className="flex-1 border-[#2D3199] text-[#2D3199] hover:bg-[#EEF0FF] font-bold rounded-xl h-11">
                {loading === "dryrun" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing…</>
                ) : (
                  <><Shield className="w-4 h-4 mr-2" />Test Run</>
                )}
              </Button>
              <Button onClick={() => setConfirmOpen(true)}
                disabled={!!loading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl h-11">
                {loading === "import" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restoring…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Restore Now</>
                )}
              </Button>
            </div>
          )}

          {importResult && (
            <Button variant="outline" onClick={reset}
              className="w-full border-[#DCE3F0] text-[#64748B] hover:bg-[#F8FAFF] font-semibold rounded-xl h-11">
              <RefreshCw className="w-4 h-4 mr-2" /> Import Another Backup
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Restore
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <p>You are about to restore data from:</p>
              <p className="font-mono text-sm bg-[#F8FAFF] p-2 rounded-lg border border-[#E2E8F0]">{file?.name}</p>
              <p>Mode: <strong>{mode === "upsert" ? "Merge — existing records will be overwritten" : "Skip duplicates — existing records kept"}</strong></p>
              <p className="text-amber-700 font-medium">This operation affects live data and cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runImport}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
              Yes, Restore Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── History Section ────────────────────────────────────────────────────────── */

function HistorySection() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["backup-history"],
    queryFn: fetchHistory,
    refetchInterval: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/backup/history/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backup-history"] });
      setDeleteId(null);
    },
  });

  const history = data?.history || [];

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-[#64748B]" />
            </div>
            <div>
              <h2 className="font-bold text-[#0F172A] text-base">Backup History</h2>
              <p className="text-sm text-[#64748B]">{history.length} record{history.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-xl text-[#94A3B8] hover:text-[#334155] hover:bg-[#F1F5F9] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#2D3199] animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="w-10 h-10 text-[#CBD5E1] mb-3" />
            <p className="font-semibold text-[#94A3B8]">No backups yet</p>
            <p className="text-xs text-[#CBD5E1] mt-1">Export a backup to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {history.map(row => {
              const isExpanded = expandedId === row.id;
              const isExport = row.type === "export";
              return (
                <div key={row.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                      ${isExport ? "bg-[#EEF0FF]" : "bg-amber-50"}`}>
                      {isExport
                        ? <Download className="w-4 h-4 text-[#2D3199]" />
                        : <Upload className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#0F172A] truncate max-w-xs">
                          {row.label || (isExport ? "Export" : "Import")}
                        </span>
                        <StatusBadge status={row.status} />
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold
                          ${isExport ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-amber-50 text-amber-700"}`}>
                          {isExport ? "Export" : "Restore"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                          <Clock className="w-3 h-3" />{formatDate(row.createdAt)}
                        </span>
                        {row.sizeBytes && (
                          <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                            <HardDrive className="w-3 h-3" />{formatBytes(row.sizeBytes)}
                          </span>
                        )}
                        {row.totalRecords != null && (
                          <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                            <Database className="w-3 h-3" />{row.totalRecords.toLocaleString()} records
                          </span>
                        )}
                        {row.createdByName && (
                          <span className="text-xs text-[#94A3B8]">by {row.createdByName}</span>
                        )}
                      </div>
                      <p className="text-xs text-[#94A3B8] font-mono mt-0.5 truncate">{row.filename}</p>
                      {row.notes && (
                        <p className="text-xs text-amber-600 mt-0.5">{row.notes}</p>
                      )}

                      {/* Expandable table stats */}
                      {row.tableStats && Object.keys(row.tableStats).length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          className="mt-2 flex items-center gap-1 text-xs text-[#2D3199] hover:underline font-semibold"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "Hide" : "Show"} table breakdown
                        </button>
                      )}
                      {isExpanded && row.tableStats && (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                          {Object.entries(row.tableStats).map(([t, c]) => (
                            <div key={t} className="flex items-center justify-between text-[11px] bg-[#F8FAFF] rounded-lg px-2 py-1 border border-[#E2E8F0]">
                              <span className="text-[#64748B] font-mono truncate">{t}</span>
                              <span className="font-bold text-[#334155] ml-1 shrink-0">{c.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteId(row.id)}
                      className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete history record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the history entry only. The actual backup file on your computer is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */

export default function AdminBackup() {
  const { data: tableData, isLoading: tablesLoading, isError: tablesError, refetch: refetchTables } = useQuery({
    queryKey: ["backup-tables"],
    queryFn: fetchTableDefs,
    staleTime: Infinity,
    retry: 2,
  });

  const tables = tableData?.tables || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A]">Backup & Restore</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Export signed backups for safekeeping or import them to migrate and recover data.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl">
          <Shield className="w-4 h-4 text-[#0EA5E9]" />
          <span className="text-xs font-semibold text-[#0369A1]">SHA-256 Integrity Verified</span>
        </div>
      </div>

      {/* Stats banner */}
      {!tablesLoading && tables.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Table2,    label: "Tables",          value: tables.length },
            { icon: Database,  label: "Format",           value: "JSON v1.0" },
            { icon: Shield,    label: "Checksum",         value: "SHA-256" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-[#DCE3F0] px-4 py-3 flex items-center gap-3">
              <Icon className="w-4 h-4 text-[#2D3199] shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-[#0F172A]">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tablesLoading ? (
          <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-[#DCE3F0]">
            <Loader2 className="w-6 h-6 text-[#2D3199] animate-spin" />
          </div>
        ) : tablesError ? (
          <div className="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-red-200 gap-3 px-6 text-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="text-sm font-semibold text-red-700">Could not load table list</p>
            <p className="text-xs text-[#64748B]">Make sure you are signed in as an admin or super-admin account.</p>
            <button
              onClick={() => refetchTables()}
              className="text-xs font-bold text-[#2D3199] hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Try again
            </button>
          </div>
        ) : (
          <ExportSection tables={tables} />
        )}
        <ImportSection />
      </div>

      <HistorySection />
    </div>
  );
}
