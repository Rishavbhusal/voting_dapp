import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import ContestantCard from "@/components/ContestantCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePoll, useVote, useAddContestant } from "@/hooks/useVoting";
import { useAdmin } from "@/contexts/AdminContext";
import AddContestantModal from "@/components/AddContestantModal";

const PollDetail = () => {
  const { id } = useParams();
  const { connected, publicKey } = useWallet();
  const [showAddContestant, setShowAddContestant] = useState(false);
  const [hasVotedLocally, setHasVotedLocally] = useState(false);

  // Fetch real poll data from blockchain
  const { poll, loading, error, refetch } = usePoll(Number(id));
  const { vote, loading: voting } = useVote();
  const { addContestant, loading: addingContestant } = useAddContestant();
  const { isAdmin: isAdminFn } = useAdmin();
  const isAdmin = isAdminFn(publicKey);

  // Check localStorage for voting status when poll and publicKey are available
  useEffect(() => {
    if (poll && publicKey) {
      const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '[]');
      const hasVoted = votedPolls.some((vp: any) => 
        vp.pollTitle === poll.title && vp.walletAddress === publicKey.toString()
      );
      setHasVotedLocally(hasVoted);
      console.log('🔄 Checked localStorage for voting status:', { 
        pollTitle: poll.title, 
        walletAddress: publicKey.toString(), 
        hasVoted 
      });
    }
  }, [poll, publicKey]);

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <Navbar />
        <div className="container mx-auto px-4 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading poll...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !poll) {
    console.log("❌ PollDetail: Showing error state");
    console.log("  - Error:", error);
    console.log("  - Poll is null:", !poll);
    return (
      <div className="min-h-screen pb-20">
        <Navbar />
        <div className="container mx-auto px-4 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-500">
              {error || "Poll not found"}
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Poll ID: {id}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isActive = now.getTime() >= poll.startsAt && now.getTime() <= poll.endsAt;
  const isUpcoming = now.getTime() < poll.startsAt;
  
  // Check if current user has voted by looking at poll's voters list OR local state
  const userHasVotedFromBlockchain = publicKey ? poll.voters.includes(publicKey.toString()) : false;
  const userHasVoted = userHasVotedFromBlockchain || hasVotedLocally;

  // Debug logging for admin functionality and voting status
  console.log("🔍 PollDetail Debug Info:");
  console.log("Connected wallet:", connected);
  console.log("Public key:", publicKey?.toString());
  console.log("Is admin:", isAdmin);
  console.log("Poll startsAt:", new Date(poll.startsAt));
  console.log("Poll endsAt:", new Date(poll.endsAt));
  console.log("Current time:", now);
  console.log("Is upcoming:", isUpcoming);
  console.log("Is active:", isActive);
  console.log("Should show Add Contestant button:", isAdmin && isUpcoming);
  console.log("Button visibility breakdown:", {
    isAdmin,
    isUpcoming,
    showButton: isAdmin && isUpcoming
  });
  console.log("🗳️ Voting Status:");
  console.log("Poll voters:", poll.voters);
  console.log("Poll voters length:", poll.voters?.length || 0);
  console.log("Current user public key:", publicKey?.toString());
  console.log("Has voted from blockchain:", userHasVotedFromBlockchain);
  console.log("Has voted locally:", hasVotedLocally);
  console.log("User has voted (final):", userHasVoted);
  console.log("Voters list details:", poll.voters?.map((voter, index) => ({
    index,
    voter,
    matches: voter === publicKey?.toString()
  })));

  const handleVote = async (contestantId: number) => {
    if (!connected) {
      toast.error("Please connect your wallet to vote");
      return;
    }

    try {
      const tx = await vote({ title: poll.title, contestantId });
      
      // Only save to localStorage if transaction was successful
      if (tx) {
        toast.success("Vote submitted successfully!");
        
        // Save to localStorage and update local state
        const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '[]');
        const newVote = {
          pollTitle: poll.title,
          walletAddress: publicKey.toString(),
          votedAt: Date.now()
        };
        
        // Remove any existing vote for this poll by this wallet
        const filteredPolls = votedPolls.filter((vp: any) => 
          !(vp.pollTitle === poll.title && vp.walletAddress === publicKey.toString())
        );
        
        // Add the new vote
        const updatedPolls = [...filteredPolls, newVote];
        localStorage.setItem('votedPolls', JSON.stringify(updatedPolls));
        
        setHasVotedLocally(true); // Immediately disable vote button
        refetch(); // Refresh poll data to show updated vote counts and voters list
      }
    } catch (error) {
      console.error("Voting error:", error);
      toast.error("Failed to submit vote");
      // Don't update localStorage or hasVotedLocally if transaction failed
    }
  };

  const handleAddContestant = async (contestantData: { name: string; image: string }) => {
    try {
      if (!isAdmin) {
        toast.error("Only admin can add contestants");
        return;
      }
      
      console.log("🔄 Adding contestant:", contestantData);
      console.log("📊 Poll before add:", poll);
      console.log("📊 Poll timing:", {
        startsAt: new Date(poll.startsAt).toISOString(),
        currentTime: new Date().toISOString(),
        isUpcoming: isUpcoming
      });
      
      const result = await addContestant({
        title: poll.title,
        name: contestantData.name,
        image: contestantData.image,
      });
      
      console.log("✅ Contestant added successfully:", result);
      toast.success(`Contestant "${contestantData.name}" added successfully!`);
      setShowAddContestant(false);
      
      console.log("🔄 Refreshing poll data...");
      await refetch();
      console.log("✅ Poll data refreshed");
      
    } catch (error) {
      console.error("❌ Add contestant error:", error);
      toast.error("Failed to add contestant: " + error.message);
    }
  };

  const getStatusBadge = () => {
    if (poll.finalized) {
      return <Badge className="bg-accent text-accent-foreground">Finalized</Badge>;
    }
    if (isActive) {
      return <Badge className="bg-primary text-primary-foreground glow-primary">Live</Badge>;
    }
    if (isUpcoming) {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
    return <Badge variant="destructive">Ended</Badge>;
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Polls
          </Button>
        </Link>

        <div className="mb-12">
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden glass-card mb-6">
            <img
              src={poll.image}
              alt={poll.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-4xl md:text-5xl font-bold gradient-text">
                  {poll.title}
                </h1>
                {getStatusBadge()}
              </div>
              
              <p className="text-lg text-muted-foreground max-w-3xl mb-4">
                {poll.description}
              </p>
              
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>
                    {isActive ? "Ends" : isUpcoming ? "Starts" : "Ended"}{" "}
                    {format(new Date(isActive || isUpcoming ? poll.endsAt : poll.endsAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-xl font-semibold">{poll.votes} total votes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Contestants</h2>
            {isAdmin && isUpcoming && (
              <Button 
                onClick={() => {
                  console.log("🔄 Add Contestant button clicked!");
                  console.log("📊 showAddContestant before:", showAddContestant);
                  setShowAddContestant(true);
                  console.log("📊 showAddContestant after:", true);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Contestant
              </Button>
            )}
          </div>
          
          {/* Debug info for button visibility */}
          <div className="mb-4 p-3 bg-blue-900/20 rounded-lg text-sm text-blue-200">
            <p><strong>Debug Info:</strong></p>
            <p>Is Admin: {isAdmin ? "✅ Yes" : "❌ No"}</p>
            <p>Is Upcoming: {isUpcoming ? "✅ Yes" : "❌ No"}</p>
            <p>Show Add Button: {isAdmin && isUpcoming ? "✅ Yes" : "❌ No"}</p>
            <p>Poll Start: {new Date(poll.startsAt).toLocaleString()}</p>
            <p>Current Time: {new Date().toLocaleString()}</p>
          </div>
          
          
          {isAdmin && !isUpcoming && (
            <p className="text-sm text-muted-foreground mb-4">
              Cannot add contestants after poll has started
            </p>
          )}
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {addingContestant && (
            <div className="col-span-full flex justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Adding contestant...
              </div>
            </div>
          )}
          {poll.contestants && poll.contestants.length > 0 ? (
            poll.contestants.map((contestant) => (
              <ContestantCard
                key={contestant.id}
                contestant={contestant}
                onVote={handleVote}
                hasVoted={userHasVoted}
                isActive={isActive}
                loading={voting}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No contestants yet</h3>
              <p className="text-muted-foreground mb-6">
                {isAdmin && isUpcoming 
                  ? "Add contestants to get started with voting"
                  : "Contestants will appear here once added"
                }
              </p>
              {isAdmin && isUpcoming && (
                <Button 
                  onClick={() => setShowAddContestant(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Contestant
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Add Contestant Modal */}
        <AddContestantModal
          isOpen={showAddContestant}
          onClose={() => {
            console.log("🔄 Modal onClose called");
            setShowAddContestant(false);
          }}
          onSubmit={handleAddContestant}
          loading={addingContestant}
        />
      </div>
    </div>
  );
};

export default PollDetail;
