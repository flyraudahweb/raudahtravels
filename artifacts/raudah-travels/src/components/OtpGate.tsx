import React, { useState, useEffect, useCallback } from "react";
import { Shield, Mail, RefreshCw, Loader2, LogOut } from "lucide-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { basePath } from "@/App";

interface TwoFaStatus {
  required: boolean;
  verified: boolean;
  maskedEmail: string;
}

export default function OtpGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const [status, setStatus] = useState<TwoFaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const sendOtp = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/2fa/send", {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to send code");
      setSent(true);
      setCountdown(60);
      // In dev mode the API returns the OTP so we can test without email
      if (d.devOtp) {
        setDevOtp(d.devOtp);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/2fa/status", { credentials: "include" });
        if (!r.ok) {
          // If status check fails, default to not required (user/pilgrim)
          setLoading(false);
          return;
        }
        const data: TwoFaStatus = await r.json();
        setStatus(data);
        if (data.required && !data.verified) {
          sendOtp();
        }
      } catch {
        // Network error — assume not 2FA required
        setLoading(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [sendOtp]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verifyOtp = async () => {
    if (otp.length < 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Invalid code");
      setStatus(prev => prev ? { ...prev, verified: true } : prev);
    } catch (err) {
      setError((err as Error).message);
      setOtp("");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <Loader2 className="w-8 h-8 text-[#2D3199] animate-spin" />
      </div>
    );
  }

  if (!status?.required || status?.verified) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1C1F66] to-[#2D3199] px-8 pt-8 pb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black text-white">Identity Verification</h1>
          <p className="text-white/60 text-sm mt-1">
            Your account requires two-factor authentication
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {sent ? (
            <>
              <div className="flex items-center gap-3 bg-[#EEF0FF] rounded-2xl px-4 py-3 mb-6">
                <Mail className="w-4 h-4 text-[#2D3199] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#2D3199]">Code sent</p>
                  <p className="text-xs text-[#64748B]">
                    We sent a 6-digit code to{" "}
                    <span className="font-bold text-[#0F172A]">{status.maskedEmail}</span>
                  </p>
                </div>
              </div>

              {/* Dev mode: show OTP directly since email provider is not configured */}
              {devOtp && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6">
                  <span className="text-lg">🔧</span>
                  <div>
                    <p className="text-xs font-bold text-amber-700">Dev Mode — Your OTP</p>
                    <p className="text-lg font-mono font-black text-amber-900 tracking-widest">{devOtp}</p>
                  </div>
                </div>
              )}
              <p className="text-xs font-black uppercase tracking-widest text-[#94A3B8] mb-4 text-center">
                Enter verification code
              </p>

              <div className="flex justify-center mb-6">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <p className="text-center text-sm text-red-500 font-semibold mb-4">{error}</p>
              )}

              <Button
                onClick={verifyOtp}
                disabled={otp.length < 6 || verifying}
                className="w-full h-12 bg-[#2D3199] hover:bg-[#252880] text-white font-black rounded-2xl text-sm"
              >
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
                ) : (
                  "Verify & Continue"
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={sendOtp}
                  disabled={sending || countdown > 0}
                  className="flex items-center gap-1.5 text-xs text-[#2D3199] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${sending ? "animate-spin" : ""}`} />
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                </button>
              </div>
            </>
          ) : (
            <>
              {error && (
                <p className="text-center text-sm text-red-500 font-semibold mb-4">{error}</p>
              )}
              <p className="text-center text-sm text-[#64748B] mb-6">
                A one-time verification code will be sent to your registered email address.
              </p>
              <Button
                onClick={sendOtp}
                disabled={sending}
                className="w-full h-12 bg-[#2D3199] hover:bg-[#252880] text-white font-black rounded-2xl text-sm"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                ) : (
                  "Send Verification Code"
                )}
              </Button>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-[#F1F5F9] flex items-center justify-center">
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-2 text-xs text-[#94A3B8] hover:text-red-500 transition-colors font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
