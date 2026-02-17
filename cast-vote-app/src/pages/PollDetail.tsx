import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import ContestantCard from "@/components/ContestantCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Plus, Trophy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePoll, useVote, useAddContestant, useFinalizePoll } from "@/hooks/useVoting";
import { useAdmin } from "@/contexts/AdminContext";
import AddContestantModal from "@/components/AddContestantModal";

const PollDetail = () => {
  const params = useParams();
  const id = params?.id as string;
  const { connected, publicKey } = useWallet();
  const [showAddContestant, setShowAddContestant] = useState(false);
  const [hasVotedLocally, setHasVotedLocally] = useState(false);

  // Fetch real poll data from blockchain
  const { poll, loading, error, refetch } = usePoll(Number(id));
  const { vote, loading: voting } = useVote();
  const { addContestant, loading: addingContestant } = useAddContestant();
  const { finalizePoll, loading: finalizing } = useFinalizePoll();
  const { isAdmin: isAdminFn } = useAdmin();
  const isAdmin = isAdminFn(publicKey);

  // Check voting status - prioritize blockchain state over localStorage
  useEffect(() => {
    // After poll is finalized, always ignore localStorage for winner logic and force UI to use only visible contestant data
    if (poll && poll.finalized) {
      setHasVotedLocally(false);
      return;
    }
    // Only use localStorage for voting state if poll is not finalized
    if (poll && publicKey && !poll.finalized) {
      const hasVotedOnBlockchain = poll.voters.includes(publicKey.toString());
      if (hasVotedOnBlockchain) {
        setHasVotedLocally(true);
        const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '[]');
        const alreadyInLocalStorage = votedPolls.some((vp: any) => 
          vp.pollTitle === poll.title && vp.walletAddress === publicKey.toString()
        );
        if (!alreadyInLocalStorage) {
          const newVote = {
            pollTitle: poll.title,
            walletAddress: publicKey.toString(),
            votedAt: Date.now()
          };
          votedPolls.push(newVote);
          localStorage.setItem('votedPolls', JSON.stringify(votedPolls));
        }
      } else {
        setHasVotedLocally(false);
        const votedPolls = JSON.parse(localStorage.getItem('votedPolls') || '[]');
        const filteredPolls = votedPolls.filter((vp: any) => 
          !(vp.pollTitle === poll.title && vp.walletAddress === publicKey.toString())
        );
        if (filteredPolls.length !== votedPolls.length) {
          localStorage.setItem('votedPolls', JSON.stringify(filteredPolls));
        }
      }
    } else if (poll && !publicKey && !poll.finalized) {
      setHasVotedLocally(false);
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
  const hasEnded = now > poll.endsAt;
  
  // Check if current user has voted - ONLY use blockchain state (source of truth)
  // Also check that poll actually has votes (safety check for data consistency)
  const userHasVoted = publicKey && poll.voters && Array.isArray(poll.voters) && poll.votes > 0
    ? poll.voters.includes(publicKey.toString()) 
    : false;

  // Check if there are any votes (either total votes or any contestant has votes)
  const hasVotes = poll.votes > 0 || (poll.contestants && poll.contestants.some((c: any) => c.votes > 0));
  
  // Always display the contestant with the most votes as the winner if any contestant has votes
  // If there is a tie for most votes, display a tie message
  let winnerContestant = null;
  let isTie = false;
  if (poll.finalized && poll.contestants && poll.contestants.length > 0) {
    const contestantsWithVotes = poll.contestants.filter((c: any) => c.votes > 0);
    if (contestantsWithVotes.length > 0) {
      // Find the highest vote count
      const maxVotes = Math.max(...contestantsWithVotes.map((c: any) => c.votes));
      // Find all contestants with the highest vote count
      const topContestants = contestantsWithVotes.filter((c: any) => c.votes === maxVotes);
      if (topContestants.length > 1) {
        isTie = true;
      } else {
        winnerContestant = topContestants[0];
      }
    }
  }

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
        if (!publicKey) return;
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
        refetch(true); // Force refresh poll data from blockchain after voting
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
      
      await refetch(true); // Force refresh poll data from blockchain after adding contestant
      
    } catch (error: any) {
      toast.error("Failed to add contestant: " + (error?.message || "Unknown error"));
    }
  };

  const handleFinalizePoll = async () => {
    try {
      if (!isAdmin) {
        toast.error("Only admin can finalize polls");
        return;
      }
      
      if (!connected) {
        toast.error("Please connect your wallet first");
        return;
      }
      
      const result = await finalizePoll(poll.title);
      
      if (result) {
        toast.success("Poll finalized successfully! Winner has been determined.");
        await refetch(true); // Force refresh poll data from blockchain after finalizing
      } else {
        toast.error("Failed to finalize poll");
      }
    } catch (error: any) {
      console.error("❌ handleFinalizePoll error:", error);
      toast.error("Failed to finalize poll: " + (error?.message || "Unknown error"));
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
        <Link href="/">
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
                    {format(new Date(isUpcoming ? poll.startsAt : poll.endsAt), "MMM d, yyyy 'at' h:mm a")}
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

        {/* Winner Announcement */}
        {/* Always render winner using only frontend contestant data, regardless of finalized state or localStorage */}
        {poll.contestants && poll.contestants.length > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-accent/20 to-primary/20 border-2 border-accent rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-accent" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-1 gradient-text">Poll Winner</h3>
                {(() => {
                  const maxVotes = Math.max(...poll.contestants.map((c: any) => c.votes));
                  const winners = poll.contestants.filter((c: any) => c.votes === maxVotes && maxVotes > 0);
                  if (winners.length === 0) {
                    return <p className="text-lg text-muted-foreground">No votes were cast in this poll.</p>;
                  }
                  if (winners.length === 1) {
                    return <p className="text-lg text-muted-foreground"><span className="font-semibold text-foreground">{winners[0].name}</span> won with <span className="font-semibold text-foreground">{winners[0].votes}</span> {winners[0].votes === 1 ? 'vote' : 'votes'}.</p>;
                  }
                  return <p className="text-lg text-muted-foreground">Tie between {winners.map((w: any, i: number) => <span key={w.name} className="font-semibold text-foreground">{w.name}{i < winners.length - 1 ? ', ' : ''}</span>)} with <span className="font-semibold text-foreground">{maxVotes}</span> {maxVotes === 1 ? 'vote' : 'votes'} each.</p>;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Finalize Poll Button */}
        {hasEnded && !poll.finalized && isAdmin && (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-yellow-600 mb-1">Poll Has Ended</p>
                <p className="text-sm text-yellow-600/90">Finalize the poll to determine and announce the winner.</p>
              </div>
              <Button 
                onClick={handleFinalizePoll}
                disabled={finalizing}
                className="bg-accent hover:bg-accent/90"
              >
                {finalizing ? "Finalizing..." : "Finalize Poll"}
              </Button>
            </div>
          </div>
        )}

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
