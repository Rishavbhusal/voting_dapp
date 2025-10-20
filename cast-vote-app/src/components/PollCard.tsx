import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Trophy } from "lucide-react";
import { format } from "date-fns";

interface PollCardProps {
  poll: {
    id: string;
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
  const now = new Date();
  const isUpcoming = now < poll.startsAt;
  const isActive = now >= poll.startsAt && now <= poll.endsAt;
  const isEnded = now > poll.endsAt;

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
    <Link to={`/poll/${poll.id}`}>
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
                {format(isActive || isUpcoming ? poll.endsAt : poll.endsAt, "MMM d, yyyy")}
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
