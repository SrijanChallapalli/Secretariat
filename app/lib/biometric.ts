import type { BiometricScanResult } from "../../shared/types.js";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

export async function fetchBiometricScan(tokenId: number): Promise<BiometricScanResult> {
  const response = await fetch(`${SERVER_URL}/biometric/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tokenId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to fetch biometric scan: ${response.statusText}`);
  }

  return response.json();
}
