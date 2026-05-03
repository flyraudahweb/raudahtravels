import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Building2, User, MapPin,
  Phone, Mail, Briefcase, Globe, Star, TrendingUp, Users, Loader2,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Contact Info", icon: User },
  { id: 2, label: "Business Info", icon: Building2 },
  { id: 3, label: "Review & Submit", icon: CheckCircle2 },
];

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

interface FormData {
  contactPerson: string;
  email: string;
  phone: string;
  businessName: string;
  bio: string;
  experienceYears: string;
  address: string;
  city: string;
  state: string;
}

const INITIAL_FORM: FormData = {
  contactPerson: "", email: "", phone: "",
  businessName: "", bio: "", experienceYears: "0",
  address: "", city: "", state: "",
};

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => {
        const done = step > s.id;
        const active = step === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div className={`flex flex-col items-center gap-1.5`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                done ? "bg-[#2D3199] border-[#2D3199] text-white" :
                active ? "bg-white border-[#2D3199] text-[#2D3199]" :
                "bg-white border-[#DCE3F0] text-[#94A3B8]"
              }`}>
                {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
              </div>
              <span className={`text-xs font-bold whitespace-nowrap ${active ? "text-[#2D3199]" : done ? "text-[#2D3199]" : "text-[#94A3B8]"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-20 h-0.5 mb-5 mx-1 transition-colors ${step > s.id ? "bg-[#2D3199]" : "bg-[#DCE3F0]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BecomeAgent() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (field: keyof FormData, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: "" }));
  };

  const validateStep1 = (): boolean => {
    const e: Partial<FormData> = {};
    if (!form.contactPerson.trim()) e.contactPerson = "Full name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<FormData> = {};
    if (!form.businessName.trim()) e.businessName = "Business name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/agents/public-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          contactPerson: form.contactPerson,
          email: form.email,
          phone: form.phone,
          bio: form.bio || undefined,
          experienceYears: parseInt(form.experienceYears) || 0,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-lg w-full text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-[#0F172A] mb-3">Application Submitted!</h2>
            <p className="text-[#64748B] leading-relaxed mb-8">
              Thank you, <strong>{form.contactPerson}</strong>! Your partnership request for <strong>{form.businessName}</strong> has been received.
              Our team will review your application and reach out to you at <strong>{form.email}</strong> within 2–3 business days.
            </p>
            <div className="bg-[#EEF0FF] rounded-2xl p-5 mb-8 text-left space-y-3">
              <h3 className="font-bold text-[#2D3199] text-sm uppercase tracking-wider">What happens next?</h3>
              {[
                "Our team reviews your application",
                "You receive an email with your login credentials",
                "You can start booking packages for your clients",
                "Earn commissions on every successful booking",
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#2D3199] text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                  <p className="text-[#334155] text-sm">{t}</p>
                </div>
              ))}
            </div>
            <Button asChild className="bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold px-8 rounded-full">
              <a href="/">Back to Home</a>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Navbar />

      {/* Hero */}
      <section className="py-16 px-4" style={{ background: "linear-gradient(135deg, #0D0F4E 0%, #1C1F66 100%)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold uppercase tracking-widest mb-5">
            <Star className="w-3 h-3 fill-[#FF3B00] text-[#FF3B00]" /> Partnership Programme
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">Become a Raudah Travels Agent</h1>
          <p className="text-white/65 text-base leading-relaxed max-w-xl mx-auto">
            Partner with Nigeria's most trusted Hajj & Umrah travel company. Earn commissions on every booking, access exclusive packages, and grow your travel business.
          </p>

          <div className="grid grid-cols-3 gap-6 mt-10 max-w-md mx-auto">
            {[
              { icon: TrendingUp, label: "Up to 15%", sub: "Commission Rate" },
              { icon: Globe, label: "100%", sub: "Visa Success" },
              { icon: Users, label: "2,400+", sub: "Happy Pilgrims" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={sub} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-5 h-5 text-white/80" />
                </div>
                <p className="text-white font-black text-lg leading-none">{label}</p>
                <p className="text-white/45 text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <main className="flex-1 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <ProgressBar step={step} />

          <div className="bg-white rounded-3xl border border-[#DCE3F0] shadow-[0_4px_24px_rgba(45,49,153,0.06)] p-8">

            {/* Step 1: Contact Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] mb-1">Contact Information</h2>
                  <p className="text-[#64748B] text-sm">Tell us about the primary contact person for this partnership.</p>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Full Name <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input value={form.contactPerson} onChange={e => set("contactPerson", e.target.value)}
                        placeholder="Abubakar Ibrahim" className="pl-10"
                        style={{ borderColor: errors.contactPerson ? "#EF4444" : undefined }} />
                    </div>
                    {errors.contactPerson && <p className="text-red-500 text-xs">{errors.contactPerson}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Email Address <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input value={form.email} onChange={e => set("email", e.target.value)}
                        type="email" placeholder="agent@example.com" className="pl-10"
                        style={{ borderColor: errors.email ? "#EF4444" : undefined }} />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Phone Number <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input value={form.phone} onChange={e => set("phone", e.target.value)}
                        placeholder="+234 800 000 0000" className="pl-10"
                        style={{ borderColor: errors.phone ? "#EF4444" : undefined }} />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Business Info */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] mb-1">Business Information</h2>
                  <p className="text-[#64748B] text-sm">Tell us about your travel agency or business.</p>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Business/Agency Name <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input value={form.businessName} onChange={e => set("businessName", e.target.value)}
                        placeholder="Sallama Travels & Tours" className="pl-10"
                        style={{ borderColor: errors.businessName ? "#EF4444" : undefined }} />
                    </div>
                    {errors.businessName && <p className="text-red-500 text-xs">{errors.businessName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Years in Travel Business</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input value={form.experienceYears} onChange={e => set("experienceYears", e.target.value)}
                        type="number" min="0" placeholder="3" className="pl-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Business Description</Label>
                    <Textarea value={form.bio} onChange={e => set("bio", e.target.value)}
                      placeholder="Tell us about your business, the services you offer, and why you'd like to partner with us..."
                      className="min-h-[100px] resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold text-[#334155]">City</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                        <Input value={form.city} onChange={e => set("city", e.target.value)}
                          placeholder="Kano" className="pl-10" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold text-[#334155]">State</Label>
                      <select value={form.state} onChange={e => set("state", e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-[#DCE3F0] bg-white text-[#334155] text-sm font-medium focus:outline-none focus:border-[#2D3199]">
                        <option value="">Select state</option>
                        {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-[#334155]">Office Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input value={form.address} onChange={e => set("address", e.target.value)}
                        placeholder="No. 1 Murtala Mohammed Way" className="pl-10" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] mb-1">Review Your Application</h2>
                  <p className="text-[#64748B] text-sm">Please confirm your details before submitting.</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#DCE3F0] bg-[#F8FAFC] p-5">
                    <h3 className="text-xs font-black text-[#2D3199] uppercase tracking-widest mb-3">Contact Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[#94A3B8] font-medium">Full Name</span><span className="font-semibold text-[#0F172A]">{form.contactPerson}</span></div>
                      <div className="flex justify-between"><span className="text-[#94A3B8] font-medium">Email</span><span className="font-semibold text-[#0F172A]">{form.email}</span></div>
                      <div className="flex justify-between"><span className="text-[#94A3B8] font-medium">Phone</span><span className="font-semibold text-[#0F172A]">{form.phone}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#DCE3F0] bg-[#F8FAFC] p-5">
                    <h3 className="text-xs font-black text-[#2D3199] uppercase tracking-widest mb-3">Business Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[#94A3B8] font-medium">Business Name</span><span className="font-semibold text-[#0F172A]">{form.businessName}</span></div>
                      {form.experienceYears && <div className="flex justify-between"><span className="text-[#94A3B8] font-medium">Experience</span><span className="font-semibold text-[#0F172A]">{form.experienceYears} years</span></div>}
                      {form.city && <div className="flex justify-between"><span className="text-[#94A3B8] font-medium">Location</span><span className="font-semibold text-[#0F172A]">{[form.city, form.state].filter(Boolean).join(", ")}</span></div>}
                      {form.bio && <div className="mt-2"><p className="text-[#94A3B8] font-medium mb-1">Description</p><p className="text-[#334155] leading-relaxed">{form.bio}</p></div>}
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">
                    {submitError}
                  </div>
                )}

                <div className="bg-[#FFF4F1] border border-[#FFD5C8] rounded-2xl p-4 text-sm text-[#6B2F1A]">
                  <p className="font-bold mb-1">By submitting, you agree that:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Your application will be reviewed by the Raudah Travels team</li>
                    <li>• You will receive an email with your login credentials upon approval</li>
                    <li>• You will adhere to Raudah Travels' agent terms and commission structure</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#F1F5F9]">
              <Button variant="outline" onClick={() => step === 1 ? (window.location.href = "/") : setStep(s => s - 1)}
                className="border-[#DCE3F0] text-[#64748B] hover:bg-[#F1F5F9] rounded-xl">
                <ChevronLeft className="w-4 h-4 mr-1" /> {step === 1 ? "Back to Home" : "Previous"}
              </Button>

              {step < 3 ? (
                <Button onClick={handleNext}
                  className="bg-[#2D3199] hover:bg-[#25297F] text-white font-bold px-8 rounded-xl">
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}
                  className="bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold px-8 rounded-xl">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Application"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
