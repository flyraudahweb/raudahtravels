import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function Privacy() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-4xl pt-32">
        <h1 className="text-4xl font-black text-[#0F172A] mb-8">Privacy Policy</h1>
        <div className="prose prose-slate max-w-none space-y-6 text-[#475569]">
          <p>At Raudah Travels &amp; Tours, your privacy is our priority. We are committed to protecting the personal information of our pilgrims and agents.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">Information We Collect</h2>
          <p>We collect information necessary to process your Hajj and Umrah bookings, including passport details, contact information, and payment records.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">How We Use Your Information</h2>
          <p>Your information is used strictly for visa processing, flight bookings, hotel reservations, and communication regarding your trip.</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">Data Protection</h2>
          <p>We implement robust security measures to ensure your data is safe and never shared with unauthorized third parties.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
