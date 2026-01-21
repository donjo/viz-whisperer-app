/**
 * API Key Modal Component
 *
 * A modal dialog for users to enter and save their Anthropic API key.
 * The key is encrypted before being stored in the database.
 */

import { useState } from "react";
import { ExternalLink, Eye, EyeOff, Key } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useToast } from "@/components/ui/use-toast.ts";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasExistingKey: boolean;
  onKeyUpdated: () => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  hasExistingKey,
  onKeyUpdated,
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    // Basic validation
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key.",
        variant: "destructive",
      });
      return;
    }

    // Check that it looks like an Anthropic key
    if (!apiKey.startsWith("sk-ant-")) {
      toast({
        title: "Invalid key format",
        description: "Anthropic API keys should start with 'sk-ant-'",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/api-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (response.ok) {
        toast({
          title: "API key saved",
          description: "Your API key has been securely encrypted and stored.",
        });
        setApiKey("");
        onKeyUpdated();
        onClose();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to save API key");
      }
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save API key",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/settings/api-key", {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "API key removed",
          description: "Your API key has been deleted.",
        });
        onKeyUpdated();
        onClose();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete API key");
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API key",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Anthropic API Key
          </DialogTitle>
          <DialogDescription>
            {hasExistingKey
              ? "You have an API key saved. Enter a new one to replace it, or delete the existing key."
              : "Enter your Anthropic API key to generate visualizations. Your key is encrypted and stored securely."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Don't have an API key?{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Get one from Anthropic
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasExistingKey && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? "Removing..." : "Remove Key"}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isDeleting || !apiKey.trim()}>
            {isSaving ? "Saving..." : hasExistingKey ? "Update Key" : "Save Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
