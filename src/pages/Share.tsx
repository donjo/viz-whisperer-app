/**
 * Share Page
 *
 * Public view of a shared visualization.
 * Does NOT require authentication.
 * Accessed at /share/[publicId]
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useToast } from "@/components/ui/use-toast.ts";

interface SharedVisualization {
  id: string;
  title: string;
  prompt: string;
  dataSourceUrl: string;
  html: string;
  createdAt: string;
}

const Share = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const { toast } = useToast();

  const [visualization, setVisualization] = useState<SharedVisualization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch visualization on mount
  useEffect(() => {
    if (publicId) {
      fetchVisualization();
    }
  }, [publicId]);

  const fetchVisualization = async () => {
    try {
      const response = await fetch(`/api/share/${publicId}`);
      if (response.ok) {
        const data = await response.json();
        setVisualization(data.visualization);
      } else if (response.status === 404) {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Failed to fetch shared visualization:", error);
      setNotFound(true);
    } finally {
      setIsLoading(false);
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

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Not found state
  if (notFound || !visualization) {
    return (
      <div className="h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border/50 bg-card/50 px-6 py-4">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <BarChart3 className="w-8 h-8 text-primary" />
            <span className="text-lg font-bold">Viz Whisperer</span>
          </a>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Visualization Not Found</h2>
            <p className="text-muted-foreground">
              This visualization may have been deleted or the link is invalid.
            </p>
            <Button asChild variant="outline">
              <a href="/">Go to Viz Whisperer</a>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border/50 bg-card/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <BarChart3 className="w-6 h-6 text-primary" />
              <span className="font-bold">Viz Whisperer</span>
            </a>
            <div className="border-l border-border pl-4">
              <h2 className="font-semibold">{visualization.title}</h2>
              <p className="text-xs text-muted-foreground">{visualization.prompt}</p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="w-4 h-4 mr-2" />
            Export HTML
          </Button>
        </div>
      </header>

      {/* Main content - iframe */}
      <main className="flex-1 overflow-hidden">
        <iframe
          srcDoc={visualization.html}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          title={visualization.title}
        />
      </main>
    </div>
  );
};

export default Share;
