"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WagmiProvider, http, createConfig } from "wagmi";
import { RainbowKitProvider, connectorsForWallets, darkTheme } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { anvilLocal, ogGalileo, adiTestnet } from "@/lib/chains";
import { metaMaskInjectedWallet } from "@/lib/metamask-injected-wallet";
import { env } from "@/lib/env";
import "@rainbow-me/rainbowkit/styles.css";

// WalletConnect returns 403 for any project id it doesn't recognise, which makes
// every WC-backed wallet fail silently (the connect modal just does nothing).
// Only offer those wallets when a real id is configured; browser-extension
// wallets connect over the injected provider and never need one.
const rawProjectId = env.NEXT_PUBLIC_WALLETCONNECT_ID;
const hasProjectId =
  /^[0-9a-fA-F]{32}$/.test(rawProjectId) && !/^0+$/.test(rawProjectId);
// connectorsForWallets throws on an empty projectId even for injected-only
// wallet lists, so always pass a syntactically valid placeholder. It is only
// ever sent to WalletConnect by WC-backed wallets, excluded below unless real.
const projectId = hasProjectId ? rawProjectId : "00000000000000000000000000000000";

const connectors = connectorsForWallets(
  hasProjectId
    ? [
        {
          groupName: "Installed",
          wallets: [metaMaskInjectedWallet, injectedWallet],
        },
        {
          groupName: "More",
          wallets: [rainbowWallet, coinbaseWallet, walletConnectWallet],
        },
      ]
    : [
        // Without a real projectId, offer only wallets that never touch the
        // WalletConnect relay: MetaMask via the injected provider, the generic
        // injected connector, and Coinbase Wallet (its SDK uses Coinbase's own
        // transport). rainbow/walletConnect always need the WC QR flow.
        {
          groupName: "Installed",
          wallets: [metaMaskInjectedWallet, injectedWallet, coinbaseWallet],
        },
      ],
  { appName: "Secretariat", projectId },
);

const config = createConfig({
  connectors,
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
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
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
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
