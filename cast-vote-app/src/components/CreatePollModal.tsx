import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCreatePoll, useVotingService } from "@/hooks/useVoting";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Plus, Loader2, AlertTriangle } from "lucide-react";

interface CreatePollModalProps {
  onSuccess?: () => void;
}

export const CreatePollModal = ({ onSuccess }: CreatePollModalProps) => {
  const { connected } = useWallet();
  const { connection } = useConnection();
  const { createPoll, loading, error } = useCreatePoll();
  const votingService = useVotingService();
  
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });
  const [titleError, setTitleError] = useState("");
  const [blockchainTime, setBlockchainTime] = useState<number | null>(null);
  const [timeDifference, setTimeDifference] = useState<number | null>(null);

  // Fetch blockchain time when modal opens
  useEffect(() => {
    if (open && votingService && connection) {
      const fetchBlockchainTime = async () => {
        try {
          const bTime = await votingService.getBlockchainTime();
          const clientTime = Math.floor(Date.now() / 1000);
          setBlockchainTime(bTime);
          setTimeDifference(clientTime - bTime);
        } catch (error) {
          // Silent fail
        }
      };
      fetchBlockchainTime();
    }
  }, [open, votingService, connection]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFormData({ ...formData, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected) {
      alert("Please connect your wallet first");
      return;
    }

    // Validate title length (Solana PDA seed limit is 32 bytes)
    const titleBytes = new TextEncoder().encode(formData.title).length;
    if (titleBytes > 32) {
      setTitleError(`Title is too long (${titleBytes} bytes). Maximum 32 bytes allowed.`);
      return;
    } else {
      setTitleError("");
    }

    // Validate dates
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      alert("Please select both start and end dates and times");
      return;
    }

    // Simple and reliable date parsing
    const startDate = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDate = new Date(`${formData.endDate}T${formData.endTime}`);
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert("Please enter valid dates and times");
      return;
    }

    // Check if end date is after start date
    if (endDate <= startDate) {
      alert("End date must be after start date");
      return;
    }

    const now = new Date();
    const minStartTime = new Date(now.getTime() - 5 * 60 * 1000);
    
    let finalStartTime = startDate;
    if (startDate < minStartTime) {
      finalStartTime = new Date(now.getTime() + 1 * 60 * 1000);
    }
    
    let finalEndTime = endDate;
    if (endDate <= finalStartTime) {
      finalEndTime = new Date(finalStartTime.getTime() + 60 * 60 * 1000);
    }

    // Adjust times to be relative to blockchain time if there's a significant difference
    let adjustedStartTime = finalStartTime.getTime();
    let adjustedEndTime = finalEndTime.getTime();
    
    if (blockchainTime && timeDifference && Math.abs(timeDifference) > 60) {
      // User wants poll to start at: finalStartTime (their selected time)
      // Blockchain time is: blockchainTime (current blockchain time in seconds)
      // Time difference: timeDifference = clientTime - blockchainTime (positive if blockchain is behind)
      //
      // The goal: Make the poll start at the user's selected time, accounting for blockchain clock being behind
      //
      // If user selects "now" (client time), we want poll to start "now" from blockchain's perspective
      // If blockchain is 33 days behind, "now" in client time = "now + 33 days" in blockchain time
      // So we need to set poll.starts_at to a value that, when compared to blockchain time, 
      // will be true when blockchain time reaches the user's desired start time
      //
      // Solution: Calculate how long from NOW (blockchain time) until the user's desired start time
      // Then set poll.starts_at = blockchainTime + (time until user's desired start)
      
      const userStartSeconds = Math.floor(finalStartTime.getTime() / 1000);
      const userEndSeconds = Math.floor(finalEndTime.getTime() / 1000);
      const clientNowSeconds = Math.floor(Date.now() / 1000);
      
      // Calculate time from blockchain "now" until user's desired start time
      // If user wants "now": timeUntilStart = 0
      // If user wants "in 1 hour": timeUntilStart = 3600
      // If user wants "yesterday": timeUntilStart = negative (we'll handle this)
      const timeUntilStartFromBlockchainNow = userStartSeconds - blockchainTime;
      const timeUntilEndFromBlockchainNow = userEndSeconds - blockchainTime;
      
      if (timeUntilStartFromBlockchainNow < 60) {
        adjustedStartTime = (blockchainTime + 60) * 1000;
        adjustedEndTime = (blockchainTime + 3660) * 1000;
      } else {
        adjustedStartTime = (blockchainTime + timeUntilStartFromBlockchainNow) * 1000;
        adjustedEndTime = (blockchainTime + timeUntilEndFromBlockchainNow) * 1000;
        
        if (adjustedEndTime <= adjustedStartTime) {
          adjustedEndTime = adjustedStartTime + (60 * 60 * 1000);
        }
      }
    }

    const result = await createPoll({
      title: formData.title,
      description: formData.description,
      image: formData.image,
      startsAt: adjustedStartTime, // Use blockchain-adjusted start time
      endsAt: adjustedEndTime,     // Use blockchain-adjusted end time
    });

    if (result) {
      alert("Poll created successfully!");
      setFormData({
        title: "",
        description: "",
        image: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
      });
      setTitleError("");
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Poll
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Poll</DialogTitle>
        </DialogHeader>
        
        {timeDifference && Math.abs(timeDifference) > 60 && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div className="text-sm text-yellow-600">
                <p className="font-semibold mb-1">Blockchain Clock Warning</p>
                <p className="text-xs">
                  Blockchain time is {Math.abs(timeDifference) > 86400 
                    ? `${Math.floor(Math.abs(timeDifference) / 86400)} days`
                    : Math.abs(timeDifference) > 3600
                    ? `${Math.floor(Math.abs(timeDifference) / 3600)} hours`
                    : `${Math.floor(Math.abs(timeDifference) / 60)} minutes`
                  } {timeDifference > 0 ? 'behind' : 'ahead'} your local time.
                </p>
                <p className="text-xs mt-1">
                  Poll times will be automatically adjusted to match blockchain time.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Poll Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                setTitleError(""); // Clear error when user types
              }}
              placeholder="Enter poll title"
              required
              className={titleError ? "border-red-500" : ""}
            />
            <div className="flex justify-between items-center mt-1">
              <span className={`text-sm ${titleError ? "text-red-500" : "text-muted-foreground"}`}>
                {titleError || `${new TextEncoder().encode(formData.title).length}/32 bytes`}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter poll description"
              required
            />
          </div>

          <div>
            <Label htmlFor="image">Image</Label>
            <div className="space-y-2">
              <Input
                id="image"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="Enter image of a poll"
                required
              />
              
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>📁 Upload Image</span>
                  </Button>
                </Label>
                <span className="text-sm text-muted-foreground">or paste URL above</span>
              </div>
              
              <div className="mt-1 text-sm text-muted-foreground">
                <p>💡 <strong>Quick options:</strong></p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFormData({ ...formData, image: "https://picsum.photos/400/300" })}
                  >
                    Random Image
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFormData({ ...formData, image: "https://via.placeholder.com/400x300" })}
                  >
                    Placeholder
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong>Current length:</strong> {formData.image.length} characters
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Start Date & Time</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="startDate" className="text-sm text-muted-foreground">Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="startTime" className="text-sm text-muted-foreground">Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">End Date & Time</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="endDate" className="text-sm text-muted-foreground">Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endTime" className="text-sm text-muted-foreground">Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Poll"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
