/**
 * Viz Page
 *
 * View a saved visualization. Requires authentication.
 * Accessed at /viz/[id]
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header.tsx";
import { ApiKeyModal } from "@/components/ApiKeyModal.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useToast } from "@/components/ui/use-toast.ts";
import { ArrowLeft, ExternalLink, FileDown, Share2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  hasApiKey: boolean;
}

interface Visualization {
  id: string;
  title: string;
  prompt: string;
  dataSourceUrl: string;
  html: string;
  publicId?: string;
  createdAt: string;
  updatedAt: string;
}

const Viz = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Visualization state
  const [visualization, setVisualization] = useState<Visualization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch visualization when authenticated
  useEffect(() => {
    if (user && id) {
      fetchVisualization();
    }
  }, [user, id]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          globalThis.location.href = `/api/auth/login?returnTo=/viz/${id}`;
        }
      } else {
        globalThis.location.href = `/api/auth/login?returnTo=/viz/${id}`;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      globalThis.location.href = `/api/auth/login?returnTo=/viz/${id}`;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const fetchVisualization = async () => {
    try {
      const response = await fetch(`/api/visualizations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setVisualization(data.visualization);
      } else if (response.status === 404) {
        toast({
          title: "Not found",
          description: "This visualization doesn't exist.",
          variant: "destructive",
        });
        navigate("/");
      } else if (response.status === 403) {
        toast({
          title: "Not authorized",
          description: "You don't have access to this visualization.",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Failed to fetch visualization:", error);
      toast({
        title: "Error",
        description: "Failed to load visualization.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!visualization) return;

    try {
      const response = await fetch(`/api/visualizations/${visualization.id}/share`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${globalThis.location.origin}/share/${data.publicId}`;

        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Share link has been copied to your clipboard.",
        });

        setVisualization((prev) => (prev ? { ...prev, publicId: data.publicId } : null));
      }
    } catch (error) {
      console.error("Failed to share:", error);
      toast({
        title: "Error",
        description: "Failed to create share link.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!visualization) return;

    const blob = new Blob([visualization.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${visualization.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "HTML file has been downloaded.",
    });
  };

  const handleDelete = async () => {
    if (!visualization) return;

    try {
      const response = await fetch(`/api/visualizations/${visualization.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({
          title: "Deleted",
          description: "Visualization has been deleted.",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: "Error",
        description: "Failed to delete visualization.",
        variant: "destructive",
      });
    }
    setShowDeleteDialog(false);
  };

  const handleKeyUpdated = () => {
    checkAuth();
  };

  // Show loading while checking auth
  if (isLoadingAuth) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header user={user} onOpenApiKeyModal={() => setShowApiKeyModal(true)} />

      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card/30 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {visualization && (
              <div>
                <h2 className="font-semibold">{visualization.title}</h2>
                <p className="text-xs text-muted-foreground">{visualization.prompt}</p>
              </div>
            )}
          </div>

          {visualization && (
            <div className="flex items-center gap-2">
              {visualization.publicId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const shareUrl =
                      `${globalThis.location.origin}/share/${visualization.publicId}`;
                    globalThis.open(shareUrl, "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Public Link
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                {visualization.publicId ? "Copy Link" : "Share"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main content - iframe */}
      <main className="flex-1 overflow-hidden">
        {isLoading
          ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-muted-foreground">Loading visualization...</div>
            </div>
          )
          : visualization
          ? (
            <iframe
              srcDoc={visualization.html}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title={visualization.title}
            />
          )
          : (
            <div className="h-full flex items-center justify-center">
              <div className="text-muted-foreground">Visualization not found</div>
            </div>
          )}
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete visualization?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The visualization will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        hasExistingKey={user.hasApiKey}
        onKeyUpdated={handleKeyUpdated}
      />
    </div>
  );
};

export default Viz;
