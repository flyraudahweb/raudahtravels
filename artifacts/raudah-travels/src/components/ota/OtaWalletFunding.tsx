import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Banknote, Check, Copy, Landmark, Wallet, WalletCards } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { ota } from "@/lib/ota";

type FundingDetails = {
  bankTransfer: { bankName: string; accountName: string; accountNumber: string; ngnPerUsd: number };
  crypto: { asset: string; network: string; address: string };
};

const OPENING_BALANCE_USD = 0;
const WALLET_CURRENCIES = ["USD", "NGN"] as const;
type WalletCurrency = (typeof WALLET_CURRENCIES)[number];
const depositAmountFormat = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function DepositConverter({ ngnPerUsd, rateLabel }: { ngnPerUsd: number; rateLabel: string }) {
  const [entry, setEntry] = useState<{ currency: WalletCurrency; text: string }>({ currency: "USD", text: "" });
  const input = entry.text.trim();
  const hasAmount = /^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(input);
  const amount = hasAmount ? Number(input.replaceAll(",", "")) : NaN;
  const converted = entry.currency === "USD" ? amount * ngnPerUsd : amount / ngnPerUsd;
  const valid = Number.isFinite(converted);
  const invalid = input !== "" && !valid && input !== ".";

  return (
    <section aria-labelledby="deposit-converter-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 id="deposit-converter-title" className="flex items-center gap-2.5 font-semibold text-slate-950">
          <ArrowRightLeft size={18} className="text-[#2D3199]" aria-hidden="true" />
          Deposit converter
        </h3>
        <p className="text-sm text-slate-600 tabular-nums">{rateLabel}</p>
      </div>
      <p id="deposit-converter-hint" className="mt-2 text-sm text-slate-600">Enter an amount in either currency.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
        {WALLET_CURRENCIES.map((currency) => {
          const editing = currency === entry.currency;
          return (
            <label key={currency} className="min-w-0 space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">{currency === "USD" ? "US dollars (USD)" : "Nigerian naira (NGN)"}</span>
              <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="text-slate-500" aria-hidden="true">{currency === "USD" ? "$" : "₦"}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={editing && invalid}
                  aria-describedby={editing && invalid ? "deposit-converter-error" : "deposit-converter-hint"}
                  value={editing ? entry.text : valid ? depositAmountFormat.format(converted) : ""}
                  placeholder="0.00"
                  onChange={(event) => setEntry({ currency, text: event.currentTarget.value })}
                  className="min-h-11 min-w-0 flex-1 bg-transparent font-medium text-slate-950 outline-none tabular-nums placeholder:text-slate-400"
                />
              </span>
            </label>
          );
        })}
      </div>
      {invalid && <p id="deposit-converter-error" role="status" className="mt-2 text-sm text-rose-700">Enter a positive amount or zero, with up to two decimal places.</p>}
    </section>
  );
}

function CopyFundingDetail({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    setCopied(false);
    setError(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError(true);
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <div className={light ? "rounded-xl bg-white/10 p-4" : "rounded-xl border border-slate-200 bg-slate-50 p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-medium ${light ? "text-indigo-100" : "text-slate-600"}`}>{label}</p>
          <p className={`mt-1 select-all font-mono ${light ? "text-xl font-bold tracking-wide text-white sm:text-2xl" : "break-all text-sm text-slate-950"}`}>{value}</p>
        </div>
        <button type="button" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${light ? "border-white/30 text-white hover:bg-white/15 focus-visible:outline-white" : "border-slate-200 bg-white text-indigo-800 hover:bg-indigo-50 focus-visible:outline-indigo-600"}`}>
          <Icon size={17} aria-hidden="true" />
        </button>
      </div>
      {(copied || error) && (
        <p role="status" className={`mt-2 text-xs ${light ? "text-indigo-100" : error ? "text-rose-800" : "text-emerald-800"}`}>
          {copied ? `${label} copied.` : "Select the value to copy it manually."}
        </p>
      )}
    </div>
  );
}

export default function OtaWalletFunding({ adminId }: { adminId: string }) {
  const [balanceCurrency, setBalanceCurrency] = useState<WalletCurrency>("USD");
  const funding = useQuery({
    queryKey: ["ota", "admin-wallet-funding", adminId],
    queryFn: ({ signal }) => ota<FundingDetails>("/admin/wallet-funding", undefined, undefined, signal),
    retry: false,
    gcTime: 0,
  });

  if (funding.isPending) return <p role="status" className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Loading wallet funding details…</p>;
  if (funding.isError) return <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{funding.error.message}</p>;

  const { bankTransfer, crypto } = funding.data;
  const rateLabel = `1 USD = ₦${new Intl.NumberFormat("en-NG").format(bankTransfer.ngnPerUsd)}`;
  const balance = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: balanceCurrency,
    currencyDisplay: "narrowSymbol",
  }).format(balanceCurrency === "USD" ? OPENING_BALANCE_USD : OPENING_BALANCE_USD * bankTransfer.ngnPerUsd);

  return (
    <section aria-labelledby="wallet-funding-title" className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-[#2D3199]"><WalletCards size={21} aria-hidden="true" /></span>
        <div>
          <h2 id="wallet-funding-title" className="text-xl font-bold tracking-tight text-slate-950">Fund the booking wallet</h2>
          <p className="text-sm text-slate-600">Send a naira bank transfer or deposit USDT on Solana.</p>
        </div>
      </div>
      <article className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#1e2358] to-[#363a94] p-5 text-white shadow-md sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-32 -z-10 size-80 rounded-full border border-white/15 bg-white/5 ring-[32px] ring-white/5" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Wallet size={20} aria-hidden="true" /></span>
            <h3 className="font-semibold text-white">Booking wallet balance</h3>
          </div>
          <div role="group" aria-label="Balance currency" className="inline-flex gap-1 rounded-xl border border-white/25 bg-slate-950/35 p-1">
            {WALLET_CURRENCIES.map((currency) => (
              <button
                key={currency}
                type="button"
                aria-pressed={balanceCurrency === currency}
                onClick={() => setBalanceCurrency(currency)}
                className="min-h-10 min-w-14 rounded-lg px-3 text-sm font-semibold text-indigo-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:bg-white aria-pressed:text-[#232667]"
              >
                {currency}
              </button>
            ))}
          </div>
        </div>
        <p aria-live="polite" className="mt-6 break-words text-4xl font-semibold tracking-tight text-white tabular-nums sm:text-5xl">
          {balance} <span className="text-base font-medium tracking-normal text-indigo-100">{balanceCurrency}</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/20 pt-4 text-sm text-indigo-100">
          <span>Opening balance</span>
          <span className="inline-flex items-center gap-2 tabular-nums"><ArrowRightLeft size={15} aria-hidden="true" />{rateLabel}</span>
        </div>
      </article>
      <DepositConverter ngnPerUsd={bankTransfer.ngnPerUsd} rateLabel={rateLabel} />
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="flex min-w-0 flex-col gap-6 rounded-2xl bg-gradient-to-br from-[#191c58] via-[#272b78] to-[#3439a1] p-5 text-white shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Landmark size={20} aria-hidden="true" /></span>
              <div><h3 className="font-bold text-white">Bank transfer</h3><p className="text-sm text-indigo-100">{bankTransfer.bankName}</p></div>
            </div>
            <span className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-semibold">NGN</span>
          </div>
          <div className="space-y-3">
            <dl><dt className="text-xs text-indigo-100">Account holder</dt><dd className="mt-1 text-lg font-semibold text-white">{bankTransfer.accountName}</dd></dl>
            <CopyFundingDetail key={bankTransfer.accountNumber} label="Account number" value={bankTransfer.accountNumber} light />
          </div>
          <div className="mt-auto flex gap-3 border-t border-white/20 pt-4">
            <ArrowRightLeft className="mt-0.5 shrink-0 text-indigo-100" size={18} aria-hidden="true" />
            <div>
              <p className="font-semibold text-white">{rateLabel}</p>
              <p className="mt-1 text-sm leading-relaxed text-indigo-100">Nomba automatically converts bank transfers to US dollars for the booking wallet. The rate shown is the funding reference rate.</p>
            </div>
          </div>
        </article>
        <article className="flex min-w-0 flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Banknote size={20} aria-hidden="true" /></span>
              <div><h3 className="font-bold text-slate-950">Crypto deposit</h3><p className="text-sm text-slate-600">{crypto.asset} on {crypto.network}</p></div>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">{crypto.network}</span>
          </div>
          <div className="mx-auto rounded-xl border border-slate-200 bg-white p-1">
            <QRCodeCanvas value={crypto.address} size={144} marginSize={4} title={`${crypto.asset} deposit address on ${crypto.network}`} />
          </div>
          <CopyFundingDetail key={crypto.address} label="Wallet address" value={crypto.address} />
          <p className="text-sm font-medium text-emerald-900">Send {crypto.asset} using the {crypto.network} network only.</p>
        </article>
      </div>
    </section>
  );
}
