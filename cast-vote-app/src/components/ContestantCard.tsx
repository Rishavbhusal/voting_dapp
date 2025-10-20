import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users } from "lucide-react";

interface ContestantCardProps {
  contestant: {
    id: number;
    name: string;
    image: string;
    votes: number;
  };
  isActive: boolean;
  hasVoted: boolean;
  isWinner?: boolean;
  onVote: (id: number) => void;
}

const ContestantCard = ({
  contestant,
  isActive,
  hasVoted,
  isWinner,
  onVote,
}: ContestantCardProps) => {
  return (
    <Card
      className={`glass-card overflow-hidden group hover:scale-[1.02] transition-all duration-300 ${
        isWinner ? "ring-2 ring-accent glow-accent" : ""
      }`}
    >
      <div className="relative h-64 overflow-hidden">
        <img
          src={contestant.image}
          alt={contestant.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        
        {isWinner && (
          <div className="absolute top-4 right-4">
            <Badge className="bg-accent text-accent-foreground glow-accent flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              Winner
            </Badge>
          </div>
        )}
      </div>
      
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
            {contestant.name}
          </h3>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-lg font-semibold">{contestant.votes} votes</span>
          </div>
        </div>
        
        {isActive && (
          <Button
            variant="vote"
            className="w-full"
            onClick={() => onVote(contestant.id)}
            disabled={hasVoted}
          >
            {hasVoted ? "Already Voted" : "Vote"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ContestantCard;
