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

  const now = Date.now();
  const isActive = now >= poll.startsAt && now <= poll.endsAt;
  const isUpcoming = now < poll.startsAt;
  
  // Check if current user has voted by looking at poll's voters list OR local state
  const userHasVotedFromBlockchain = publicKey ? poll.voters.includes(publicKey.toString()) : false;
  const userHasVoted = userHasVotedFromBlockchain || hasVotedLocally;

  const handleVote = async (contestantId: number) => {
    if (!connected) {
      toast.error("Please connect your wallet to vote");
      return;
    }

    // Validate poll is active before attempting to vote
    const currentTime = Date.now();
    
    // CRITICAL: Check poll start time (blockchain uses Unix timestamp in seconds)
    // poll.startsAt is in milliseconds, so we compare directly
    if (currentTime < poll.startsAt) {
      const timeUntilStart = Math.ceil((poll.startsAt - currentTime) / 1000 / 60); // minutes
      toast.error(`This poll has not started yet. It will start in ${timeUntilStart} minute(s).`);
      console.error('❌ Vote blocked: Poll not started', {
        currentTime,
        currentTimeSeconds: Math.floor(currentTime / 1000),
        pollStartTime: poll.startsAt,
        pollStartTimeSeconds: Math.floor(poll.startsAt / 1000),
        timeUntilStart: poll.startsAt - currentTime,
        timeUntilStartSeconds: Math.floor((poll.startsAt - currentTime) / 1000),
        isActive,
      });
      return; // CRITICAL: Return early to prevent transaction
    }
    
    if (currentTime > poll.endsAt) {
      toast.error("This poll has ended. Voting is no longer available.");
      console.error('❌ Vote blocked: Poll ended', {
        currentTime,
        pollEndTime: poll.endsAt,
        timeSinceEnd: currentTime - poll.endsAt,
        isActive,
      });
      return; // CRITICAL: Return early to prevent transaction
    }

    if (userHasVoted) {
      toast.error("You have already voted in this poll.");
      return; // CRITICAL: Return early to prevent transaction
    }

    if (!isActive) {
      toast.error("This poll is not currently active. Please check the poll status.");
      console.error('❌ Vote blocked: Poll not active', {
        currentTime,
        pollStartTime: poll.startsAt,
        pollEndTime: poll.endsAt,
        isActive,
      });
      return; // CRITICAL: Return early to prevent transaction
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
    } catch (error: any) {
      // Handle specific error messages
      if (error?.message?.includes("PollNotStarted") || error?.message?.includes("poll has not started")) {
        toast.error("This poll has not started yet. Please wait until the poll begins.");
      } else if (error?.message?.includes("PollEnded") || error?.message?.includes("poll ended")) {
        toast.error("This poll has ended. Voting is no longer available.");
      } else if (error?.message?.includes("AlreadyVoted") || error?.message?.includes("already voted")) {
        toast.error("You have already voted in this poll.");
      } else {
        toast.error(error?.message || "Failed to submit vote");
      }
      console.error('❌ Vote error:', error);
      // Don't update localStorage or hasVotedLocally if transaction failed
    }
  };

  const handleAddContestant = async (contestantData: { name: string; image: string }) => {
    try {
      if (!isAdmin) {
        toast.error("Only admin can add contestants");
        return;
      }
      
      const result = await addContestant({
        title: poll.title,
        name: contestantData.name,
        image: contestantData.image,
      });
      
      toast.success(`Contestant "${contestantData.name}" added successfully!`);
      setShowAddContestant(false);
      
      await refetch();
      
    } catch (error) {
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
                onClick={() => setShowAddContestant(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Contestant
              </Button>
            )}
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
          onClose={() => setShowAddContestant(false)}
          onSubmit={handleAddContestant}
          loading={addingContestant}
        />
      </div>
    </div>
  );
};

export default PollDetail;
