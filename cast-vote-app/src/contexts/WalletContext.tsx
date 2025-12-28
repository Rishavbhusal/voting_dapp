import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider = ({ children }: WalletContextProviderProps) => {
  // Connect to Solana devnet - using a faster RPC endpoint
  // You can replace this with a dedicated RPC provider like Helius, QuickNode, etc. for better performance
  const endpoint = useMemo(() => {
    // Try using a faster public RPC or your own RPC endpoint
    // For now, using the default devnet endpoint
    return clusterApiUrl(WalletAdapterNetwork.Devnet);
    // For better performance, use: "https://api.devnet.solana.com" or a dedicated RPC
  }, []);

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
