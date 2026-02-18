"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ogGalileo, adiTestnet } from "@/lib/chains";
import "@rainbow-me/rainbowkit/styles.css";

// WalletConnect Cloud projectId must be exactly 32 characters. Get one at https://cloud.walletconnect.com
const raw = typeof process.env.NEXT_PUBLIC_WALLETCONNECT_ID === "string" ? process.env.NEXT_PUBLIC_WALLETCONNECT_ID.trim() : "";
const VALID_FALLBACK = "00000000000000000000000000000000";
const projectId = raw.length === 32 ? raw : VALID_FALLBACK;
const config = getDefaultConfig({
  appName: "Secretariat",
  projectId,
  chains: [ogGalileo, adiTestnet],
  transports: {
    [ogGalileo.id]: http(ogGalileo.rpcUrls.default.http[0]),
    [adiTestnet.id]: http(adiTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
