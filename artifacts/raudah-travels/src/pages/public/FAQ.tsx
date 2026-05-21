import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function FAQ() {
  const faqs = [
    { q: "What is included in the Hajj/Umrah packages?", a: "Our packages typically include visa processing, return flights, hotel accommodation in Makkah and Madinah, ground transportation, and guided ziyarah." },
    { q: "How do I secure my booking?", a: "You can secure your booking by paying a deposit online or through our designated bank accounts. Full payment must be completed before the specified deadline." },
    { q: "Are you licensed by NAHCON?", a: "Yes, Raudah Travels & Tours is fully licensed and registered with the National Hajj Commission of Nigeria (NAHCON)." },
    { q: "Can I pay in installments?", a: "Yes, we offer flexible payment plans. Please contact our support team to arrange a suitable payment schedule." },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-4xl pt-32">
        <h1 className="text-4xl font-black text-[#0F172A] mb-8">Frequently Asked Questions</h1>
        <div className="space-y-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#DCE3F0]">
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">{faq.q}</h3>
              <p className="text-[#475569] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
