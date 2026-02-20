"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { ogGalileo, adiTestnet } from "@/lib/chains";
import { env } from "@/lib/env";
import "@rainbow-me/rainbowkit/styles.css";

const VALID_FALLBACK = "00000000000000000000000000000000";
const projectId = env.NEXT_PUBLIC_WALLETCONNECT_ID.length === 32
  ? env.NEXT_PUBLIC_WALLETCONNECT_ID
  : VALID_FALLBACK;
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
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#D4AF37",
            accentColorForeground: "#1a0f0a",
            borderRadius: "medium",
          })}
          initialChain={ogGalileo}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
