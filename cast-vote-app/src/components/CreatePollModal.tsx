import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCreatePoll } from "@/hooks/useVoting";
import { useWallet } from "@solana/wallet-adapter-react";
import { Plus, Loader2 } from "lucide-react";

interface CreatePollModalProps {
  onSuccess?: () => void;
}

export const CreatePollModal = ({ onSuccess }: CreatePollModalProps) => {
  const { connected } = useWallet();
  const { createPoll, loading, error } = useCreatePoll();
  
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result.length > 500) {
          alert("Image is too large. Please use a smaller image or a URL instead.");
          return;
        }
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

    // Use the user's selected dates but ensure they're valid
    const now = new Date();
    const minStartTime = new Date(now.getTime() - 5 * 60 * 1000); // Allow 5 minutes in the past
    
    console.log('📅 Original UI dates:');
    console.log('Start from UI:', startDate.toLocaleString());
    console.log('End from UI:', endDate.toLocaleString());
    console.log('Current time:', now.toLocaleString());
    
    // Only adjust if start time is more than 5 minutes in the past
    let finalStartTime = startDate;
    if (startDate < minStartTime) {
      finalStartTime = new Date(now.getTime() + 1 * 60 * 1000); // 1 minute from now
      console.log('⚠️ Start time was too far in the past, adjusted to:', finalStartTime.toLocaleString());
    } else {
      console.log('✅ Using your selected start time:', finalStartTime.toLocaleString());
    }
    
    // Ensure end time is after start time
    let finalEndTime = endDate;
    if (endDate <= finalStartTime) {
      finalEndTime = new Date(finalStartTime.getTime() + 60 * 60 * 1000); // 1 hour later
      console.log('⚠️ End time was before start time, adjusted to:', finalEndTime.toLocaleString());
    } else {
      console.log('✅ Using your selected end time:', finalEndTime.toLocaleString());
    }
    
    console.log('🕐 Final dates being used:');
    console.log('Start:', finalStartTime.toLocaleString());
    console.log('End:', finalEndTime.toLocaleString());

    const result = await createPoll({
      title: formData.title,
      description: formData.description,
      image: formData.image,
      startsAt: finalStartTime.getTime(), // Use adjusted start time
      endsAt: finalEndTime.getTime(),   // Use adjusted end time
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
                placeholder="Enter image URL or upload image"
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
                <p className="mt-2">
                  <strong>Current length:</strong> {formData.image.length}/500 characters
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
