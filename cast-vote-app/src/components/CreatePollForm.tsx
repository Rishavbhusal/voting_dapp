import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreatePoll } from "@/hooks/useVoting";
import { useWallet } from "@solana/wallet-adapter-react";

interface CreatePollFormProps {
  onSuccess?: () => void;
}

export const CreatePollForm = ({ onSuccess }: CreatePollFormProps) => {
  const { connected } = useWallet();
  const { createPoll, loading, error } = useCreatePoll();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image: "",
    startsAt: "",
    endsAt: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected) {
      alert("Please connect your wallet first");
      return;
    }

    const result = await createPoll({
      title: formData.title,
      description: formData.description,
      image: formData.image,
      startsAt: Math.floor(new Date(formData.startsAt).getTime() / 1000),
      endsAt: Math.floor(new Date(formData.endsAt).getTime() / 1000),
    });

    if (result) {
      alert("Poll created successfully!");
      setFormData({
        title: "",
        description: "",
        image: "",
        startsAt: "",
        endsAt: "",
      });
      onSuccess?.();
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please connect your wallet to create a poll</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Poll Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter poll title"
          required
        />
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
        <Label htmlFor="image">Image URL</Label>
        <Input
          id="image"
          value={formData.image}
          onChange={(e) => setFormData({ ...formData, image: e.target.value })}
          placeholder="Enter image URL"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startsAt">Start Date</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={formData.startsAt}
            onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="endsAt">End Date</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            value={formData.endsAt}
            onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
            required
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating Poll..." : "Create Poll"}
      </Button>
    </form>
  );
};
