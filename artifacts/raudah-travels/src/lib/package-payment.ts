async function packagePayment(path: "initialize" | "verify", body: Record<string, string>) {
  const response = await fetch(`/api/payments/paystack/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Check the booking before trying to pay again.");
  return data as { verified?: boolean; authorizationUrl?: string };
}

export async function openAgentPackagePayment(bookingId: string) {
  const data = await packagePayment("initialize", { bookingId });
  if (data.verified) return true;
  const url = data.authorizationUrl ? new URL(data.authorizationUrl) : null;
  if (url?.origin !== "https://checkout.paystack.com")
    throw new Error("Checkout is temporarily unavailable. The booking is saved.");
  window.location.assign(url.href);
  return false;
}

export async function verifyAgentPackagePayment(reference: string) {
  return (await packagePayment("verify", { reference })).verified === true;
}
