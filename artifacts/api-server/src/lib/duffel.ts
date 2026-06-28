import { Duffel } from "@duffel/api";

const token = process.env.DUFFEL_API_TOKEN;

if (!token) {
  console.warn("[flights] DUFFEL_API_TOKEN not set — flight search will not work");
}

export const duffel = new Duffel({
  token: token || "duffel_test_placeholder",
});

// Fixed exchange rate: 1 GBP = 1818.56 NGN
export const GBP_TO_NGN_RATE = 1818.56;

export function convertToNgn(gbpAmount: number): number {
  return Math.ceil(gbpAmount * GBP_TO_NGN_RATE);
}
