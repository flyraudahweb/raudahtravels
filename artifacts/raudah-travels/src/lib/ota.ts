export async function ota<T = any>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api/ota${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    credentials: "include",
    signal,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error || "Travel service is unavailable. Please try again.",
    );
  return data;
}
export const money = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(kobo / 100);
export const destinations = [
  { name: "Makkah, Saudi Arabia", lat: 21.4225, lng: 39.8262 },
  { name: "Madinah, Saudi Arabia", lat: 24.4672, lng: 39.6111 },
  { name: "Jeddah, Saudi Arabia", lat: 21.5433, lng: 39.1728 },
  { name: "Lagos, Nigeria", lat: 6.4541, lng: 3.3947 },
  { name: "Abuja, Nigeria", lat: 9.0765, lng: 7.3986 },
  { name: "Kano, Nigeria", lat: 12.0022, lng: 8.592 },
  { name: "Dubai, UAE", lat: 25.2048, lng: 55.2708 },
  { name: "London, United Kingdom", lat: 51.5072, lng: -0.1276 },
  { name: "Istanbul, Türkiye", lat: 41.0082, lng: 28.9784 },
  { name: "Doha, Qatar", lat: 25.2854, lng: 51.531 },
  { name: "Accra, Ghana", lat: 5.6037, lng: -0.187 },
  { name: "Cairo, Egypt", lat: 30.0444, lng: 31.2357 },
  { name: "Nairobi, Kenya", lat: -1.2864, lng: 36.8172 },
  { name: "Johannesburg, South Africa", lat: -26.2041, lng: 28.0473 },
  { name: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { name: "New York, United States", lat: 40.7128, lng: -74.006 },
];
export const travelInput =
  "w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100";
export const travelButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D3199] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#212575] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
