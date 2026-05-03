import { useState, useRef } from "react";
import { useListDocuments, getListDocumentsQueryKey, useCreateDocument } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Plus, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const typeIcons: Record<string, string> = { passport: "🛂", visa: "🗂", ticket: "✈", voucher: "📋" };
const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  verified: { label: "Verified", color: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200" },
};

export default function DashboardDocuments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListDocuments({}, { query: { queryKey: getListDocumentsQueryKey({}) } });
  const createDocument = useCreateDocument();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "passport" as const, fileName: "", url: "" });
  const [fileLoading, setFileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = data?.documents || [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: "File too large", description: "Please choose a file under 5 MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setFileLoading(true);
    try {
      const base64 = await readFileAsBase64(file);
      setForm((f) => ({ ...f, fileName: file.name, url: base64 }));
    } catch {
      toast({ title: "Could not read file", description: "Please try again.", variant: "destructive" });
      e.target.value = "";
    } finally {
      setFileLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ type: "passport", fileName: "", url: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url) {
      toast({ title: "No file selected", description: "Please choose a file to upload.", variant: "destructive" });
      return;
    }
    createDocument.mutate(
      { data: { type: form.type, url: form.url, fileName: form.fileName } },
      {
        onSuccess: () => {
          toast({ title: "Document uploaded", description: "Your document has been submitted for review." });
          qc.invalidateQueries({ queryKey: getListDocumentsQueryKey({}) });
          setOpen(false);
          resetForm();
        },
        onError: () => toast({ title: "Upload failed", description: "Could not upload document.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6" data-testid="page-dashboard-documents">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-primary">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your travel documents</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-upload-document">
              <Plus className="w-4 h-4 mr-2" /> Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Upload Document</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Document Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as typeof form.type }))}>
                  <SelectTrigger data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="ticket">Flight Ticket</SelectItem>
                    <SelectItem value="voucher">Voucher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fileUpload">Select File</Label>
                <Input
                  id="fileUpload"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  required
                  data-testid="input-file-upload"
                />
                {form.fileName && !fileLoading && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium truncate">✓ {form.fileName}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG or PNG — max 5 MB</p>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary"
                disabled={createDocument.isPending || fileLoading || !form.url}
                data-testid="button-submit-document"
              >
                <Upload className="w-4 h-4 mr-2" />
                {fileLoading ? "Reading file…" : createDocument.isPending ? "Uploading…" : "Upload Document"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No documents yet</h3>
            <p className="text-muted-foreground">Upload your passport, visa, and travel documents here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const config = statusConfig[doc.status] || statusConfig.pending;
            return (
              <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      {typeIcons[doc.type] || "📄"}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{doc.type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{doc.fileName || doc.url} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${config.color}`}>{config.label}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-view-doc-${doc.id}`}
                      onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
