import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function Terms() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-4xl pt-32">
        <h1 className="text-4xl font-black text-[#0F172A] mb-8">Terms &amp; Conditions</h1>
        <div className="prose prose-slate max-w-none space-y-6 text-[#475569]">
          <p>Welcome to Raudah Travels &amp; Tours. By booking a package with us, you agree to the following terms and conditions.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">Bookings and Payments</h2>
          <p>All bookings are subject to availability. A deposit is required to secure your spot, with full payment due before the visa processing deadline.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">Cancellations and Refunds</h2>
          <p>Cancellations made before visa processing may be eligible for a partial refund. No refunds are available once visas and flights are issued.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">Travel Documents</h2>
          <p>Pilgrims are responsible for providing accurate and valid travel documents (e.g., Nigerian passport) in a timely manner.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">Compliance</h2>
          <p>As a NAHCON licensed operator, we strictly adhere to the rules and regulations of the Saudi Ministry of Hajj and Umrah.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
