import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Calendar, Plus, ShieldCheck } from "lucide-react";
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
  nationality: string;
  gender: string;
  passport_number: string;
  passport_expiry: string;
  email: string;
  phone_number: string;
};

interface PassengerFormProps {
  onSubmit: (data: PassengerData) => void;
  isLoading: boolean;
}

export default function PassengerForm({ onSubmit, isLoading }: PassengerFormProps) {
  const [travellersCount, setTravellersCount] = useState(1);
  const [form, setForm] = useState<PassengerData>({
    title: "Mrs",
    given_name: "Aisha",
    family_name: "Bello",
    born_on: "1985-03-14",
    nationality: "Nigeria",
    gender: "female",
    passport_number: "A01234542",
    passport_expiry: "2031-09-02",
    email: "aisha.bello@email.com",
    phone_number: "+234 803 000 0000",
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
    if (!form.phone_number.trim())
      newErrors.phone_number = "Valid phone required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSubmit(form);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <form id="passenger-checkout-form" onSubmit={handleSubmit} className="space-y-6">
        {/* ── Traveller 1 Card (PDF Page 3 Mockup) ── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-base font-black text-[#0F172A]">
              Traveller 1 · Adult
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              Names must match the passport
            </span>
          </div>

          {/* Row 1: Title, First Name, Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                TITLE
              </label>
              <Select value={form.title} onValueChange={(v) => update("title", v)}>
                <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm">
                  <SelectValue placeholder="Title" />
                </SelectTrigger>
                <SelectContent>
                  {["Mr", "Mrs", "Ms", "Dr", "Alhaji", "Hajiya"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                FIRST NAME
              </label>
              <Input
                value={form.given_name}
                onChange={(e) => update("given_name", e.target.value)}
                placeholder="Aisha"
                className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
              />
              {errors.given_name && <p className="text-[10px] text-red-500 mt-1">{errors.given_name}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                LAST NAME
              </label>
              <Input
                value={form.family_name}
                onChange={(e) => update("family_name", e.target.value)}
                placeholder="Bello"
                className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
              />
              {errors.family_name && <p className="text-[10px] text-red-500 mt-1">{errors.family_name}</p>}
            </div>
          </div>

          {/* Row 2: Date of Birth, Nationality, Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                DATE OF BIRTH
              </label>
              <Input
                type="date"
                value={form.born_on}
                onChange={(e) => update("born_on", e.target.value)}
                className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
              />
              {errors.born_on && <p className="text-[10px] text-red-500 mt-1">{errors.born_on}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                NATIONALITY
              </label>
              <Input
                value={form.nationality}
                onChange={(e) => update("nationality", e.target.value)}
                placeholder="Nigeria"
                className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                GENDER
              </label>
              <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Passport Number, Passport Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                PASSPORT NUMBER
              </label>
              <Input
                value={form.passport_number}
                onChange={(e) => update("passport_number", e.target.value)}
                placeholder="A01234542"
                className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                PASSPORT EXPIRY
              </label>
              <Input
                type="date"
                value={form.passport_expiry}
                onChange={(e) => update("passport_expiry", e.target.value)}
                className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
              />
            </div>
          </div>

          {/* Contact Details Section */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
              Contact details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                  EMAIL
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="aisha.bello@email.com"
                  className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
                />
                {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                  PHONE (WHATSAPP)
                </label>
                <Input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                  placeholder="+234 803 000 0000"
                  className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm"
                />
                {errors.phone_number && <p className="text-[10px] text-red-500 mt-1">{errors.phone_number}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Add Traveller 2 action */}
        {travellersCount < 2 ? (
          <button
            type="button"
            onClick={() => setTravellersCount(2)}
            className="flex items-center gap-1.5 text-sm font-bold text-[#FF4E00] hover:underline px-1"
          >
            <Plus className="w-4 h-4" />
            + Add Traveller 2 · Adult
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-[#0F172A]">
                Traveller 2 · Adult
              </h3>
              <button
                type="button"
                onClick={() => setTravellersCount(1)}
                className="text-xs text-red-500 font-bold hover:underline"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                  FULL NAME
                </label>
                <Input defaultValue="Ibrahim Bello" className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                  PASSPORT NUMBER
                </label>
                <Input defaultValue="A09876543" className="h-11 rounded-xl border-gray-200 bg-[#F8FAFC] font-semibold text-sm" />
              </div>
            </div>
          </div>
        )}
      </form>
    </motion.div>
  );
}
