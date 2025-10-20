import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Vote, Crown } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAdmin } from "@/contexts/AdminContext";

const Navbar = () => {
  const { connected, publicKey } = useWallet();
  const { isAdmin } = useAdmin();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Vote className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-bold gradient-text">VoteDApp</span>
          </Link>
          
          <div className="flex items-center gap-3">
            {connected && isAdmin(publicKey) && (
              <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-600">Admin</span>
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
