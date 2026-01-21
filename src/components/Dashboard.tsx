/**
 * Dashboard Component
 *
 * Shown to logged-in users on the home page.
 * Displays a table of their saved visualizations.
 */

import { useEffect, useState } from "react";
import { ExternalLink, FileDown, MoreHorizontal, Plus, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
import { useToast } from "@/components/ui/use-toast.ts";

// Visualization data from the API
interface Visualization {
  id: string;
  title: string;
  prompt: string;
  dataSourceUrl: string;
  publicId?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardProps {
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
}

export function Dashboard({ onOpenApiKeyModal, hasApiKey }: DashboardProps) {
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch visualizations on mount
  useEffect(() => {
    fetchVisualizations();
  }, []);

  const fetchVisualizations = async () => {
    try {
      const response = await fetch("/api/visualizations");
      if (response.ok) {
        const data = await response.json();
        setVisualizations(data.visualizations || []);
      }
    } catch (error) {
      console.error("Failed to fetch visualizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/visualizations/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setVisualizations((prev) => prev.filter((v) => v.id !== id));
        toast({
          title: "Deleted",
          description: "Visualization has been deleted.",
        });
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: "Error",
        description: "Failed to delete visualization.",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  const handleShare = async (id: string) => {
    try {
      const response = await fetch(`/api/visualizations/${id}/share`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${globalThis.location.origin}/share/${data.publicId}`;

        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Share link has been copied to your clipboard.",
        });

        // Update the visualization in state
        setVisualizations((prev) =>
          prev.map((v) => (v.id === id ? { ...v, publicId: data.publicId } : v))
        );
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

  const handleUnshare = async (id: string) => {
    try {
      const response = await fetch(`/api/visualizations/${id}/share`, {
        method: "DELETE",
      });
      if (response.ok) {
        setVisualizations((prev) =>
          prev.map((v) => (v.id === id ? { ...v, publicId: undefined } : v))
        );
        toast({
          title: "Unshared",
          description: "Share link has been revoked.",
        });
      }
    } catch (error) {
      console.error("Failed to unshare:", error);
    }
  };

  const handleExport = async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/visualizations/${id}`);
      if (response.ok) {
        const data = await response.json();
        // Download as HTML file
        const blob = new Blob([data.visualization.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Exported",
          description: "HTML file has been downloaded.",
        });
      }
    } catch (error) {
      console.error("Failed to export:", error);
      toast({
        title: "Error",
        description: "Failed to export visualization.",
        variant: "destructive",
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Truncate text with ellipsis
  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* API Key warning banner */}
      {!hasApiKey && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-amber-200 text-sm">
            <strong>API key required:</strong>{" "}
            You need to set your Anthropic API key before creating visualizations.{" "}
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="underline hover:text-amber-100"
            >
              Set it now
            </button>
          </p>
        </div>
      )}

      {/* Header with title and new button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Your Visualizations</h2>
          <p className="text-muted-foreground text-sm">
            {visualizations.length === 0
              ? "Create your first visualization to get started"
              : `${visualizations.length} visualization${visualizations.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button asChild>
          <a href="/create">
            <Plus className="w-4 h-4 mr-2" />
            New Visualization
          </a>
        </Button>
      </div>

      {/* Content */}
      {isLoading
        ? <div className="text-center py-12 text-muted-foreground">Loading...</div>
        : visualizations.length === 0
        ? (
          /* Empty state */
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">No visualizations yet</h3>
              <p className="text-muted-foreground text-sm">
                Create your first visualization by connecting to a data source and describing the
                chart you want.
              </p>
              <Button asChild className="mt-4">
                <a href="/create">Create your first visualization</a>
              </Button>
            </div>
          </div>
        )
        : (
          /* Visualizations table */
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Data Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visualizations.map((viz) => (
                  <TableRow key={viz.id}>
                    <TableCell>
                      <a
                        href={`/viz/${viz.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {viz.title}
                      </a>
                      <p className="text-xs text-muted-foreground mt-1">
                        {truncate(viz.prompt, 60)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {truncate(viz.dataSourceUrl, 40)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(viz.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/viz/${viz.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(viz.id, viz.title)}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export HTML
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {viz.publicId
                            ? (
                              <DropdownMenuItem onClick={() => handleUnshare(viz.id)}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Unshare
                              </DropdownMenuItem>
                            )
                            : (
                              <DropdownMenuItem onClick={() => handleShare(viz.id)}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(viz.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
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
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
