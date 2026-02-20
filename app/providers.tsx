"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { anvilLocal, ogGalileo, adiTestnet } from "@/lib/chains";
import { env } from "@/lib/env";
import "@rainbow-me/rainbowkit/styles.css";

const VALID_FALLBACK = "00000000000000000000000000000000";
const projectId = env.NEXT_PUBLIC_WALLETCONNECT_ID.length === 32
  ? env.NEXT_PUBLIC_WALLETCONNECT_ID
  : VALID_FALLBACK;
const config = getDefaultConfig({
  appName: "Secretariat",
  projectId,
  chains: [anvilLocal, ogGalileo, adiTestnet],
  transports: {
    [anvilLocal.id]: http(anvilLocal.rpcUrls.default.http[0]),
    [ogGalileo.id]: http(ogGalileo.rpcUrls.default.http[0]),
    [adiTestnet.id]: http(adiTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7524/ingest/696202e6-6f08-414a-95f0-39ceaf6652dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ecf8bf'},body:JSON.stringify({sessionId:'ecf8bf',runId:'run1',hypothesisId:'H1',location:'providers.tsx:Providers',message:'WalletConnect projectId on mount',data:{rawEnvLength:env.NEXT_PUBLIC_WALLETCONNECT_ID.length,rawEnvValue:env.NEXT_PUBLIC_WALLETCONNECT_ID,resolvedProjectId:projectId,isFallback:projectId===VALID_FALLBACK},timestamp:Date.now()})}).catch(()=>{});
  }, []);
  // #endregion
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#D4AF37",
            accentColorForeground: "#1a0f0a",
            borderRadius: "medium",
          })}
          initialChain={process.env.NEXT_PUBLIC_CHAIN_ID === "31337" ? anvilLocal : ogGalileo}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
