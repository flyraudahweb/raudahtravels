import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PassengerData = {
  title: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: string;
  email: string;
  phone_number: string;
};

interface PassengerFormProps {
  onSubmit: (data: PassengerData) => void;
  isLoading: boolean;
}

export default function PassengerForm({ onSubmit, isLoading }: PassengerFormProps) {
  const [form, setForm] = useState<PassengerData>({
    title: "",
    given_name: "",
    family_name: "",
    born_on: "",
    gender: "",
    email: "",
    phone_number: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PassengerData, string>>>({});

  function update(field: keyof PassengerData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.title) newErrors.title = "Required";
    if (!form.given_name.trim()) newErrors.given_name = "Required";
    if (!form.family_name.trim()) newErrors.family_name = "Required";
    if (!form.born_on) newErrors.born_on = "Required";
    if (!form.gender) newErrors.gender = "Required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Valid email required";
    if (!form.phone_number.trim() || form.phone_number.replace(/\D/g, "").length < 7)
      newErrors.phone_number = "Valid phone required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSubmit(form);
  }

  const inputClasses = (field: keyof PassengerData) =>
    `h-11 bg-white/60 border-border/50 rounded-xl font-medium focus:border-primary focus:ring-primary/20 ${
      errors[field] ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">Passenger Details</h3>
            <p className="text-sm text-muted-foreground">Enter traveller information exactly as on passport</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Title</Label>
            <Select value={form.title} onValueChange={(v) => update("title", v)}>
              <SelectTrigger className={inputClasses("title")}>
                <SelectValue placeholder="Select title" />
              </SelectTrigger>
              <SelectContent>
                {["Mr", "Mrs", "Ms", "Dr"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.title && <p className="text-xs text-destructive font-medium">{errors.title}</p>}
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gender</Label>
            <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
              <SelectTrigger className={inputClasses("gender")}>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m">Male</SelectItem>
                <SelectItem value="f">Female</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && <p className="text-xs text-destructive font-medium">{errors.gender}</p>}
          </div>

          {/* First Name */}
          <div className="space-y-1.5">
            <Label htmlFor="given_name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">First Name</Label>
            <Input
              id="given_name"
              value={form.given_name}
              onChange={(e) => update("given_name", e.target.value)}
              placeholder="John"
              className={inputClasses("given_name")}
            />
            {errors.given_name && <p className="text-xs text-destructive font-medium">{errors.given_name}</p>}
          </div>

          {/* Last Name */}
          <div className="space-y-1.5">
            <Label htmlFor="family_name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Last Name</Label>
            <Input
              id="family_name"
              value={form.family_name}
              onChange={(e) => update("family_name", e.target.value)}
              placeholder="Doe"
              className={inputClasses("family_name")}
            />
            {errors.family_name && <p className="text-xs text-destructive font-medium">{errors.family_name}</p>}
          </div>

          {/* Date of Birth */}
          <div className="space-y-1.5">
            <Label htmlFor="born_on" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                id="born_on"
                type="date"
                value={form.born_on}
                onChange={(e) => update("born_on", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className={`pl-10 ${inputClasses("born_on")}`}
              />
            </div>
            {errors.born_on && <p className="text-xs text-destructive font-medium">{errors.born_on}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="john@example.com"
                className={`pl-10 ${inputClasses("email")}`}
              />
            </div>
            {errors.email && <p className="text-xs text-destructive font-medium">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <Input
                id="phone"
                type="tel"
                value={form.phone_number}
                onChange={(e) => update("phone_number", e.target.value)}
                placeholder="+234 800 000 0000"
                className={`pl-10 ${inputClasses("phone_number")}`}
              />
            </div>
            {errors.phone_number && <p className="text-xs text-destructive font-medium">{errors.phone_number}</p>}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/30">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-xl shadow-brand hover:shadow-brand-lg transition-all duration-300 border-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Continue to Payment"
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
