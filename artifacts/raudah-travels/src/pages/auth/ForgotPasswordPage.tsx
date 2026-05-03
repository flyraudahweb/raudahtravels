import { SignIn } from "@clerk/react";
import { Link } from "wouter";
import { ArrowLeft, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "linear-gradient(145deg, #F0F2FF 0%, #EEF0FF 100%)" }}>

      {/* Top nav */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 group">
          <img src="/logo.png" alt="Raudah Travels & Tours" className="h-10 w-auto object-contain" />
        </Link>
        <Link
          href="/sign-in"
          className="flex items-center gap-1.5 text-sm font-semibold text-[#2D3199] hover:text-[#1C1F66] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Header card */}
          <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6 mb-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-7 h-7 text-[#2D3199]" />
            </div>
            <h1 className="text-xl font-black text-[#0F172A] mb-2">Reset Your Password</h1>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Enter your email address below and we'll send you a verification code to reset your password.
            </p>
          </div>

          {/* Clerk handles the full forgot-password flow */}
          <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
            <SignIn
              routing="hash"
              signUpUrl={`${basePath}/sign-up`}
              appearance={{
                variables: {
                  colorPrimary: "#2D3199",
                  colorBackground: "#ffffff",
                  colorInputBackground: "#ffffff",
                  colorText: "#0F172A",
                  colorTextSecondary: "#64748B",
                  borderRadius: "0.75rem",
                  fontFamily: "Lato, sans-serif",
                },
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-0 rounded-none",
                  headerTitle: "text-[#0F172A] font-black",
                  headerSubtitle: "text-[#64748B]",
                  formButtonPrimary: "bg-[#2D3199] hover:bg-[#1C1F66] text-white font-bold shadow-none",
                  socialButtonsBlockButton: "border border-[#DCE3F0] text-[#334155] hover:bg-[#F1F5F9] font-semibold",
                  formFieldInput: "border-[#DCE3F0] focus:border-[#2D3199] focus:ring-[#2D3199]/20 rounded-xl",
                  formFieldLabel: "text-[#334155] font-semibold text-sm",
                  footerActionLink: "text-[#2D3199] hover:text-[#25297F] font-semibold",
                  formResendCodeLink: "text-[#2D3199]",
                  navbar: "hidden",
                  footer: "hidden",
                },
              }}
            />
          </div>

          <p className="text-center text-xs text-[#94A3B8] mt-6">
            Remember your password?{" "}
            <Link href="/sign-in" className="text-[#2D3199] font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
