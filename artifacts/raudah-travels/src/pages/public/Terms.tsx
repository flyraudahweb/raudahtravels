import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PackageCancellationDetails } from "@/components/CancellationPolicy";

export default function Terms() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-4xl pt-32">
        <h1 className="text-4xl font-black text-[#0F172A] mb-8">
          Terms &amp; Conditions
        </h1>
        <div className="prose prose-slate max-w-none space-y-6 text-[#475569]">
          <p>
            Welcome to Raudah Travels &amp; Tours. By booking a package with us,
            you agree to the following terms and conditions.
          </p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">
            Bookings and Payments
          </h2>
          <p>
            All bookings are subject to availability. A deposit is required to
            secure your spot, with full payment due before the visa processing
            deadline.
          </p>
          <h2
            id="package-cancellations"
            className="text-2xl font-bold text-[#0F172A] mt-8 mb-4 scroll-mt-32"
          >
            Package Cancellations and Refunds
          </h2>
          <PackageCancellationDetails detailed />
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">
            Travel Documents
          </h2>
          <p>
            Pilgrims are responsible for providing accurate and valid travel
            documents (e.g., Nigerian passport) in a timely manner.
          </p>
          <h2 className="text-2xl font-bold text-[#0F172A] mt-8 mb-4">
            Compliance
          </h2>
          <p>
            As a NAHCON licensed operator, we strictly adhere to the rules and
            regulations of the Saudi Ministry of Hajj and Umrah.
          </p>
          <h2
            id="travel-cancellations"
            className="text-2xl font-bold text-[#0F172A] mt-8 mb-4 scroll-mt-32"
          >
            Flight and Hotel Cancellation Policy
          </h2>
          <p>
            Flight refunds and fees depend on the airline’s rules for the ticket
            you book. Hotel refunds and fees depend on your room rate and when
            you cancel. Review the cancellation policy shown at checkout before
            paying.
          </p>
          <p>
            To request cancellation of a confirmed flight or hotel booking, open
            the booking in My Trips and send a cancellation request. Our travel
            team will confirm the applicable fees and any refund.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
