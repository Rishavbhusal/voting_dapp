import Navbar from "@/components/Navbar";
import PollCard from "@/components/PollCard";
import { Button } from "@/components/ui/button";
import { Vote, Sparkles, Shield, Zap, RefreshCw } from "lucide-react";
import { usePolls } from "@/hooks/useVoting";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAdmin } from "@/contexts/AdminContext";
import { CreatePollModal } from "@/components/CreatePollModal";

const Index = () => {
  const { connected, publicKey } = useWallet();
  const { polls, loading, error, refetch } = usePolls();
  const { isAdmin } = useAdmin();

  // Transform Solana poll data to match PollCard component expectations
  const transformedPolls = polls.map((poll) => {
    console.log(`🔗 Index: Poll "${poll.title}" has ID: ${poll.id}`);
    return {
      id: poll.id, // Keep as number, don't convert to string
      title: poll.title,
      description: poll.description,
      image: poll.image,
      startsAt: new Date(poll.startsAt), // poll.startsAt is already in milliseconds
      endsAt: new Date(poll.endsAt), // poll.endsAt is already in milliseconds
      votes: poll.votes,
      finalized: poll.finalized,
      contestants: poll.contestants.length,
    };
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-32 pb-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">Powered by Solana</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 gradient-text leading-tight">
            Decentralized Voting Platform
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Transparent, secure, and trustless voting on the blockchain. Cast your vote and make your voice heard.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="gradient" size="lg" className="text-lg">
              <Vote className="mr-2" />
              Explore Polls
            </Button>
            <Button variant="outline" size="lg" className="text-lg">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="glass-card p-8 text-center group hover:glow-primary transition-all duration-300">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Secure & Transparent</h3>
            <p className="text-muted-foreground">
              All votes are recorded on-chain, ensuring complete transparency and immutability.
            </p>
          </div>
          
          <div className="glass-card p-8 text-center group hover:glow-primary transition-all duration-300">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
              <Zap className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-2">Fast & Efficient</h3>
            <p className="text-muted-foreground">
              Lightning-fast voting powered by Solana's high-performance blockchain.
            </p>
          </div>
          
          <div className="glass-card p-8 text-center group hover:glow-primary transition-all duration-300">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
              <Vote className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Easy to Use</h3>
            <p className="text-muted-foreground">
              Connect your wallet and start voting in seconds. No complicated setup required.
            </p>
          </div>
        </div>
      </section>

      {/* Active Polls */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-4xl font-bold gradient-text">Active Polls</h2>
            <div className="flex items-center gap-2">
              {connected && isAdmin(publicKey) && (
                <CreatePollModal onSuccess={refetch} />
              )}
              <Button 
                variant="outline" 
                onClick={refetch} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-xl text-muted-foreground">
            Browse ongoing and upcoming polls. Connect your wallet to participate.
          </p>
        </div>
        
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">Error loading polls: {error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="h-48 bg-gray-700 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-700 rounded mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : transformedPolls.length === 0 ? (
          <div className="text-center py-12">
            <Vote className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">No polls found</h3>
            <p className="text-muted-foreground mb-4">
              {connected 
                ? isAdmin(publicKey)
                  ? "No polls have been created yet. Create the first poll as an admin!"
                  : "No polls have been created yet. Wait for an admin to create polls."
                : "Connect your wallet to see polls or create new ones."
              }
            </p>
            {connected && isAdmin(publicKey) && (
              <CreatePollModal onSuccess={refetch} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {transformedPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;

