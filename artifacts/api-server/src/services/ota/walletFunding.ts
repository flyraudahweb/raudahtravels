import { z } from "zod";
import { decryptSetting, encryptSetting } from "../registration/config";

export const OTA_WALLET_FUNDING_KEY = "ota_wallet_funding";

const fundingSchema = z.object({
  bankTransfer: z.object({
    bankName: z.string().trim().min(1).max(100),
    accountName: z.string().trim().min(1).max(100),
    accountNumber: z.string().regex(/^\d{10}$/),
    ngnPerUsd: z.number().positive().max(100_000),
  }),
  crypto: z.object({
    asset: z.literal("USDT"),
    network: z.literal("Solana"),
    address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  }),
});

export function encryptWalletFunding(value: unknown) {
  return encryptSetting(JSON.stringify(fundingSchema.parse(value)), OTA_WALLET_FUNDING_KEY);
}

export function readWalletFunding(value: unknown) {
  return fundingSchema.parse(JSON.parse(decryptSetting(z.string().parse(value), OTA_WALLET_FUNDING_KEY)));
}
