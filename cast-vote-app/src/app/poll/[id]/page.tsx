"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import ContestantCard from "@/components/ContestantCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Plus, Trophy, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePoll, useVote, useAddContestant, useVotingService, useFinalizePoll, useDeletePoll } from "@/hooks/useVoting";
import { useAdmin } from "@/contexts/AdminContext";
import { useConnection } from "@solana/wallet-adapter-react";
import AddContestantModal from "@/components/AddContestantModal";
import { AlertTriangle, Clock } from "lucide-react";

export default function PollDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [showAddContestant, setShowAddContestant] = useState(false);
  const [hasVotedLocally, setHasVotedLocally] = useState(false);
  const [blockchainTime, setBlockchainTime] = useState<number | null>(null);
  const [blockchainTimeLoading, setBlockchainTimeLoading] = useState(false);

  // Fetch real poll data from blockchain
  const { poll, loading, error, refetch } = usePoll(Number(id));
  const { vote, loading: voting } = useVote();
  const { addContestant, loading: addingContestant } = useAddContestant();
  const { finalizePoll, loading: finalizing } = useFinalizePoll();
  const { deletePoll, loading: deleting } = useDeletePoll();
  const { isAdmin: isAdminFn } = useAdmin();
  const isAdmin = isAdminFn(publicKey);
  const votingService = useVotingService();

  // Fetch blockchain time when poll is loaded
  useEffect(() => {
    if (poll && votingService && connection) {
      const fetchBlockchainTime = async () => {
        setBlockchainTimeLoading(true);
        try {
          const bTime = await votingService.getBlockchainTime();
          setBlockchainTime(bTime);
        } catch (error) {
          // Silent fail
        } finally {
          setBlockchainTimeLoading(false);
        }
      };
      fetchBlockchainTime();
    }
  }, [poll, votingService, connection]);

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

  // Convert poll times to seconds (blockchain uses seconds)
  const pollStartsAtSeconds = Math.floor(poll.startsAt / 1000);
  const pollEndsAtSeconds = Math.floor(poll.endsAt / 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);
  
  // Use blockchain time if available, otherwise fall back to client time
  const effectiveTime = blockchainTime || nowSeconds;
  
  // Check if poll is active based on blockchain time (blockchain compares in seconds)
  const isActiveOnBlockchain = effectiveTime >= pollStartsAtSeconds && effectiveTime <= pollEndsAtSeconds;
  const isUpcomingOnBlockchain = effectiveTime < pollStartsAtSeconds;
  const hasEndedOnBlockchain = effectiveTime > pollEndsAtSeconds;
  
  // Also check client time for UI display
  const isActive = nowSeconds >= pollStartsAtSeconds && nowSeconds <= pollEndsAtSeconds;
  const isUpcoming = nowSeconds < pollStartsAtSeconds;
  
  // Calculate time difference and time until start on blockchain
  const timeDifference = blockchainTime ? nowSeconds - blockchainTime : null;
  const timeUntilStartOnBlockchain = blockchainTime ? pollStartsAtSeconds - blockchainTime : null;
  
  // Check if current user has voted by looking at poll's voters list OR local state
  const userHasVotedFromBlockchain = publicKey ? poll.voters.includes(publicKey.toString()) : false;
  const userHasVoted = userHasVotedFromBlockchain || hasVotedLocally;
  
  // Check if poll has ended and determine winner
  const hasEnded = effectiveTime > pollEndsAtSeconds;
  // Winner ID from contract matches the contestant's ID (which is the array index)
  // Check for both undefined and null, and handle 0 as a valid winner ID
  const winnerContestantId = (poll.winner !== undefined && poll.winner !== null) ? poll.winner : null;
  const winnerContestant = winnerContestantId !== null && poll.finalized 
    ? poll.contestants.find((c: any) => c.id === winnerContestantId)
    : null;

  const handleVote = async (contestantId: number) => {
    if (!connected) {
      toast.error("Please connect your wallet to vote");
      return;
    }

    // Basic validation - blockchain will handle time validation with actual blockchain time
    if (userHasVoted) {
      toast.error("You have already voted in this poll.");
      return;
    }

    // Check if poll has started (using client time for UI, contract has 5-minute buffer)
    // The contract will do the final validation with a 5-minute buffer
    if (!isActive) {
      if (isUpcoming) {
        const timeUntilStart = pollStartsAtSeconds - nowSeconds;
        if (timeUntilStart > 0) {
          toast.error(`Poll has not started yet. It will start in ${formatTimeRemaining(timeUntilStart)}.`);
        } else {
          toast.error("Poll has not started yet. Please wait until the poll begins.");
        }
      } else {
        toast.error("This poll has ended. Voting is no longer available.");
      }
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
          walletAddress: publicKey?.toString(),
          votedAt: Date.now()
        };
        
        // Remove any existing vote for this poll by this wallet
        const filteredPolls = votedPolls.filter((vp: any) => 
          !(vp.pollTitle === poll.title && vp.walletAddress === publicKey?.toString())
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
      
    } catch (error: any) {
      toast.error("Failed to add contestant: " + (error?.message || "Unknown error"));
    }
  };

  const handleFinalizePoll = async () => {
    try {
      console.log("🔵 handleFinalizePoll called");
      console.log("🔵 isAdmin:", isAdmin);
      console.log("🔵 poll.title:", poll.title);
      console.log("🔵 publicKey:", publicKey?.toString());
      
      if (!isAdmin) {
        toast.error("Only admin can finalize polls");
        return;
      }
      
      if (!connected) {
        toast.error("Please connect your wallet first");
        return;
      }
      
      console.log("🔵 Calling finalizePoll...");
      const result = await finalizePoll(poll.title);
      console.log("🔵 finalizePoll result:", result);
      
      if (result) {
        toast.success("Poll finalized successfully! Winner has been determined.");
        await refetch();
      } else {
        toast.error("Finalize poll returned no result");
      }
    } catch (error: any) {
      console.error("❌ handleFinalizePoll error:", error);
      console.error("❌ Error message:", error?.message);
      console.error("❌ Error code:", error?.code);
      console.error("❌ Error logs:", error?.logs);
      toast.error("Failed to finalize poll: " + (error?.message || "Unknown error"));
    }
  };

  const handleDeletePoll = async () => {
    try {
      if (!isAdmin) {
        toast.error("Only admin can delete polls");
        return;
      }
      
      if (!connected) {
        toast.error("Please connect your wallet first");
        return;
      }

      // Confirm deletion
      if (!confirm(`Are you sure you want to delete the poll "${poll.title}"? This action cannot be undone.`)) {
        return;
      }

      // Check if poll has votes (contract prevents deletion if votes exist)
      if (poll.votes > 0) {
        toast.error("Cannot delete a poll that has votes. Please finalize the poll instead.");
        return;
      }

      const result = await deletePoll(poll.title);
      
      if (result) {
        toast.success("Poll deleted successfully!");
        // Redirect to home page after deletion
        window.location.href = "/";
      } else {
        toast.error("Delete poll returned no result");
      }
    } catch (error: any) {
      console.error("❌ handleDeletePoll error:", error);
      toast.error("Failed to delete poll: " + (error?.message || "Unknown error"));
    }
  };

  const getStatusBadge = () => {
    if (poll.finalized) {
      return <Badge className="bg-accent text-accent-foreground">Finalized</Badge>;
    } 
    // Use client time for UI display, but blockchain time for actual voting validation
    // This way users see accurate status based on their time, but voting still respects blockchain time
    if (isActive) {
      return <Badge className="bg-primary text-primary-foreground glow-primary">Live</Badge>;
    }
    if (isUpcoming) {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
    return <Badge variant="destructive">Ended</Badge>;
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Polls
          </Button>
        </Link>

        {/* Blockchain Time Warning */}
        {timeDifference && Math.abs(timeDifference) > 60 && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-600 mb-1">Blockchain Clock Warning</p>
                <p className="text-sm text-yellow-600/90 mb-2">
                  The blockchain clock is {Math.abs(timeDifference) > 86400 
                    ? `${Math.floor(Math.abs(timeDifference) / 86400)} days`
                    : Math.abs(timeDifference) > 3600
                    ? `${Math.floor(Math.abs(timeDifference) / 3600)} hours`
                    : `${Math.floor(Math.abs(timeDifference) / 60)} minutes`
                  } {timeDifference > 0 ? 'behind' : 'ahead'} your local time.
                </p>
                {timeUntilStartOnBlockchain !== null && timeUntilStartOnBlockchain > 0 && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600/90">
                    <Clock className="w-4 h-4" />
                    <span>
                      Poll will start on blockchain in: <strong>{formatTimeRemaining(timeUntilStartOnBlockchain)}</strong>
                    </span>
                  </div>
                )}
                {blockchainTime && (
                  <p className="text-xs text-yellow-600/80 mt-2">
                    Blockchain time: {new Date(blockchainTime * 1000).toLocaleString()} | 
                    Your time: {new Date().toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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
                  <div className="flex flex-col">
                    <span>
                      {isActive ? "Ends" : isUpcoming ? "Starts" : "Ended"}{" "}
                      {format(new Date(isActive || isUpcoming ? poll.endsAt : poll.endsAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    {isUpcoming && (
                      <span className="text-xs text-muted-foreground">
                        Ends: {format(new Date(poll.endsAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    )}
                  </div>
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
        {hasEnded && poll.finalized && (
          <div className="mb-8 p-6 bg-gradient-to-r from-accent/20 to-primary/20 border-2 border-accent rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-accent" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-1 gradient-text">Poll Finalized!</h3>
                {winnerContestant ? (
                  <p className="text-lg text-muted-foreground">
                    <span className="font-semibold text-foreground">{winnerContestant.name}</span> won with <span className="font-semibold text-foreground">{winnerContestant.votes}</span> {winnerContestant.votes === 1 ? 'vote' : 'votes'}
                  </p>
                ) : (
                  <p className="text-lg text-muted-foreground">
                    No votes were cast in this poll.
                  </p>
                )}
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

        {/* Delete Poll Button - Only show if poll has no votes */}
        {isAdmin && poll.votes === 0 && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-600 mb-1">Delete Poll</p>
                <p className="text-sm text-red-600/90">This poll has no votes. You can delete it permanently.</p>
              </div>
              <Button 
                onClick={handleDeletePoll}
                disabled={deleting}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Deleting..." : "Delete Poll"}
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
            poll.contestants.map((contestant: any) => (
              <ContestantCard
                key={contestant.id}
                contestant={contestant}
                onVote={handleVote}
                hasVoted={userHasVoted}
                isActive={isActive}
                isWinner={hasEnded && poll.finalized && winnerContestantId !== null && contestant.id === winnerContestantId}
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
}

