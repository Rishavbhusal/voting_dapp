import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddContestantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; image: string }) => void;
  loading?: boolean;
}

const AddContestantModal = ({ isOpen, onClose, onSubmit, loading = false }: AddContestantModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    image: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && formData.image.trim()) {
      onSubmit(formData);
      setFormData({ name: "", image: "" });
    }
  };

  const handleClose = () => {
    setFormData({ name: "", image: "" });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Contestant</DialogTitle>
          <DialogDescription>
            Add a new contestant to this poll. You can only add contestants before the poll starts.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Contestant Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter contestant name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            <Input
              id="image"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="Enter image URL or use quick options"
              required
            />
            <div className="flex flex-wrap gap-2 mt-1">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setFormData({ ...formData, image: "https://picsum.photos/200/200" })}
              >
                Random Image
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setFormData({ ...formData, image: "https://via.placeholder.com/200x200" })}
              >
                Placeholder
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Length: {formData.image.length}/500 characters
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim() || !formData.image.trim()}>
              {loading ? "Adding..." : "Add Contestant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddContestantModal;
