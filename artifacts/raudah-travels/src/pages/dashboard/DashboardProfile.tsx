import { useState, useEffect } from "react";
import { useGetProfile, getGetProfileQueryKey, useUpdateProfile } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function DashboardProfile() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useUser();
  const { data: profile, isLoading } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    ninNumber: "",
    passportNumber: "",
  });
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        address: profile.address || "",
        dateOfBirth: profile.dateOfBirth || "",
        ninNumber: profile.ninNumber || "",
        passportNumber: profile.passportNumber || "",
      });
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { data: { ...form } },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Your profile has been saved successfully." });
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        },
        onError: () => toast({ title: "Update failed", description: "Could not save profile changes.", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-dashboard-profile">
      <div>
        <h1 className="text-2xl font-bold font-serif text-primary">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Keep your information accurate and up to date</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatarUrl || user?.imageUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-serif">
                {form.fullName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{profile?.fullName}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize font-medium mt-1 inline-block">{profile?.role}</span>
            </div>
          </div>

          <Separator className="mb-6" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} data-testid="input-profile-fullname" />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+234 800 000 0000" data-testid="input-profile-phone" />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} data-testid="input-profile-dob" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Your residential address" data-testid="input-profile-address" />
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-4 text-primary">Travel Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passportNumber">Passport Number</Label>
                  <Input id="passportNumber" value={form.passportNumber} onChange={(e) => setForm((f) => ({ ...f, passportNumber: e.target.value }))} placeholder="A12345678" data-testid="input-profile-passport" />
                </div>
                <div>
                  <Label htmlFor="ninNumber">NIN Number</Label>
                  <Input id="ninNumber" value={form.ninNumber} onChange={(e) => setForm((f) => ({ ...f, ninNumber: e.target.value }))} placeholder="12345678901" data-testid="input-profile-nin" />
                </div>
              </div>
            </div>

            <Button type="submit" className="bg-primary" disabled={updateProfile.isPending} data-testid="button-save-profile">
              <Save className="w-4 h-4 mr-2" />
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
