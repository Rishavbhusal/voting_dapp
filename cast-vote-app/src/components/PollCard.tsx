"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Trophy } from "lucide-react";
import { format } from "date-fns";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVotingService } from "@/hooks/useVoting";

interface PollCardProps {
  poll: {
    id: number | string;
    title: string;
    description: string;
    image: string;
    startsAt: Date;
    endsAt: Date;
    votes: number;
    finalized: boolean;
    contestants: number;
  };
}

const PollCard = ({ poll }: PollCardProps) => {
  const { connection } = useConnection();
  const votingService = useVotingService();
  const [blockchainTime, setBlockchainTime] = useState<number | null>(null);

  // Fetch blockchain time once when component mounts
  useEffect(() => {
    if (votingService && connection) {
      const fetchBlockchainTime = async () => {
        try {
          const bTime = await votingService.getBlockchainTime();
          setBlockchainTime(bTime);
        } catch (error) {
          console.warn('Could not fetch blockchain time for PollCard:', error);
        }
      };
      fetchBlockchainTime();
    }
  }, [votingService, connection]);

  // Convert poll times to seconds for comparison
  const pollStartsAtSeconds = Math.floor(poll.startsAt.getTime() / 1000);
  const pollEndsAtSeconds = Math.floor(poll.endsAt.getTime() / 1000);
  
  // Use blockchain time if available, otherwise fall back to client time
  const effectiveTime = blockchainTime || Math.floor(Date.now() / 1000);
  
  // Check status based on effective time (blockchain time if available)
  const isUpcoming = effectiveTime < pollStartsAtSeconds;
  const isActive = effectiveTime >= pollStartsAtSeconds && effectiveTime <= pollEndsAtSeconds;
  const isEnded = effectiveTime > pollEndsAtSeconds;

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
    <Link href={`/poll/${poll.id}`}>
      <Card className="glass-card overflow-hidden group hover:scale-[1.02] transition-all duration-300 hover:glow-primary">
        <div className="relative h-48 overflow-hidden">
          <img
            src={poll.image}
            alt={poll.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          <div className="absolute top-4 right-4">{getStatusBadge()}</div>
        </div>
        
        <CardHeader>
          <CardTitle className="text-xl group-hover:text-primary transition-colors">
            {poll.title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-muted-foreground line-clamp-2">{poll.description}</p>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>
                {isActive ? "Ends" : isUpcoming ? "Starts" : "Ended"}{" "}
                {format(isActive || isUpcoming ? poll.endsAt : poll.endsAt, "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{poll.votes} votes</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Trophy className="w-4 h-4" />
              <span>{poll.contestants} contestants</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default PollCard;
