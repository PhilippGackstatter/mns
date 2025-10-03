"use client";

import { WalletProvider } from "@demox-labs/miden-wallet-adapter-react";
import {
  MidenWalletAdapter,
  WalletModalProvider,
} from "@demox-labs/miden-wallet-adapter";
import { useMemo } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => {
    try {
      return [new MidenWalletAdapter({ appName: "Miden Web App" })];
    } catch (error) {
      console.error("Failed to initialize wallet adapter:", error);
      return [];
    }
  }, []);

  return (
    <WalletProvider wallets={wallets} onError={(error) => {
      console.error("Wallet error:", error);
    }}>
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletProvider>
  );
}
