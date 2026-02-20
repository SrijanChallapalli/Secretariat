import type { BiometricScanResult } from "../../shared/types";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export async function fetchBiometricScan(
  tokenId: number,
): Promise<BiometricScanResult> {
  const res = await fetch(`${SERVER_URL}/biometric/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenId }),
  });
  if (!res.ok) throw new Error(`Biometric scan failed: ${res.status}`);
  return res.json();
}
