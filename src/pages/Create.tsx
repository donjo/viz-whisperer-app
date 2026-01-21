/**
 * Create Page
 *
 * The visualization creation interface. Requires authentication.
 * Users enter a data source URL and describe the visualization they want.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiInput } from "@/components/ApiInput.tsx";
import { PreviewWindow } from "@/components/PreviewWindow.tsx";
import { VisualizationChat } from "@/components/VisualizationChat.tsx";
import { Header } from "@/components/Header.tsx";
import { ApiKeyModal } from "@/components/ApiKeyModal.tsx";
import { CodeGenerator } from "@/utils/CodeGenerator.ts";
import { Button } from "@/components/ui/button.tsx";
import { useToast } from "@/components/ui/use-toast.ts";
import { Save } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable.tsx";

interface ApiData {
  url: string;
  data: any;
  structure: {
    fields: Array<{
      name: string;
      type: string;
      sample: any;
    }>;
    totalRecords: number;
  };
}

interface GeneratedCode {
  html?: string;
  css?: string;
  javascript?: string;
  fullCode?: string;
  sandboxId?: string;
  sandboxUrl?: string;
  visualizationId?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  hasApiKey: boolean;
}

const Create = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Visualization state
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  const [lastIsInitial, setLastIsInitial] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
          // Prompt for API key if not set
          if (!data.user.hasApiKey) {
            setShowApiKeyModal(true);
          }
        } else {
          // Not authenticated - redirect to login
          globalThis.location.href = "/api/auth/login?returnTo=/create";
        }
      } else {
        // Not authenticated - redirect to login
        globalThis.location.href = "/api/auth/login?returnTo=/create";
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      globalThis.location.href = "/api/auth/login?returnTo=/create";
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleDataFetched = (data: ApiData) => {
    setApiData(data);
    setGeneratedCode(null);
  };

  const handleVisualizationRequest = async (prompt: string, isInitial: boolean) => {
    if (!apiData) return;

    // Check if user has API key set
    if (!user?.hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setLastPrompt(prompt);
    setLastIsInitial(isInitial);

    try {
      let code;
      if (isInitial || !generatedCode) {
        // For authenticated users, the API key is fetched from the server
        code = await CodeGenerator.generateVisualization(apiData, prompt);
      } else {
        code = await CodeGenerator.iterateVisualization(generatedCode, prompt, apiData);
      }
      setGeneratedCode(code);
    } catch (error) {
      console.error("Failed to generate visualization:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to generate visualization";
      setGenerationError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    if (lastPrompt) {
      handleVisualizationRequest(lastPrompt, lastIsInitial);
    }
  };

  const handleSave = async () => {
    if (!generatedCode || !apiData || !lastPrompt) return;

    setIsSaving(true);
    try {
      // Generate a title from the prompt (first 50 chars)
      const title = lastPrompt.length > 50 ? lastPrompt.slice(0, 47) + "..." : lastPrompt;

      const response = await fetch("/api/visualizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          prompt: lastPrompt,
          dataSourceUrl: apiData.url,
          sandboxUrl: generatedCode.sandboxUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Saved!",
          description: "Your visualization has been saved.",
        });
        // Navigate to the saved visualization
        navigate(`/viz/${data.visualization.id}`);
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save visualization",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyUpdated = () => {
    // Refresh user info to get updated hasApiKey status
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

  // Should have user at this point (or redirected to login)
  if (!user) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header user={user} onOpenApiKeyModal={() => setShowApiKeyModal(true)} />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Data Input */}
          <ResizablePanel
            defaultSize={30}
            minSize={20}
            maxSize={50}
            className="bg-card/30"
          >
            <div className="h-full overflow-y-auto p-4">
              <ApiInput onDataFetched={handleDataFetched} />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/50 hover:bg-border transition-colors" />

          {/* Right Panel - Preview + Chat */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              {/* Preview Window (Top) */}
              <ResizablePanel defaultSize={70} minSize={50}>
                <div className="h-full flex flex-col">
                  {/* Save button bar when we have a visualization */}
                  {generatedCode?.sandboxUrl && (
                    <div className="flex-shrink-0 p-2 border-b border-border/50 bg-card/30 flex justify-end">
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        size="sm"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Visualization"}
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <PreviewWindow
                      generatedCode={generatedCode}
                      isLoading={isGenerating}
                      error={generationError}
                      onRetry={handleRetry}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle
                withHandle
                className="bg-border/50 hover:bg-border transition-colors"
              />

              {/* Visualization Chat (Bottom) */}
              <ResizablePanel defaultSize={30} minSize={15} maxSize={50} className="bg-card/20">
                <VisualizationChat
                  hasData={!!apiData}
                  onVisualizationRequest={handleVisualizationRequest}
                  isGenerating={isGenerating}
                  generatedCode={generatedCode}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

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

export default Create;
