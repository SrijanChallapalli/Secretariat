/**
 * MetaMask wallet entry that connects via the plain injected provider
 * (window.ethereum) instead of the MetaMask SDK.
 *
 * RainbowKit's stock `metaMaskWallet` routes extension connections through
 * `@metamask/sdk`, whose handshake can hang indefinitely on "Confirm
 * connection in the extension" (a known SDK issue, especially on localhost).
 * The injected connector talks directly to the extension and does not have
 * this problem — it's the same path as RainbowKit's "Browser Wallet".
 */
import type { Wallet, WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";

export const metaMaskInjectedWallet = (
  params: Parameters<typeof metaMaskWallet>[0],
): Wallet => {
  // Reuse the stock wallet's branding (icon, download links, install
  // instructions) and swap only the connector.
  const base = metaMaskWallet(params);
  return {
    ...base,
    // Drop the WalletConnect QR fallback — without a real projectId it
    // dead-ends against a 403 from the WC relay.
    qrCode: undefined,
    mobile: undefined,
    createConnector: (walletDetails: WalletDetailsParams) =>
      createConnector((config) => ({
        // "metaMask" is a predefined wagmi target: it picks the MetaMask
        // provider out of window.ethereum (EIP-6963 aware).
        ...injected({ target: "metaMask" })(config),
        ...walletDetails,
      })),
  };
};
