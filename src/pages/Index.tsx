import { useEffect, useState } from "react";
import { ApiInput } from "@/components/ApiInput.tsx";
import { PreviewWindow } from "@/components/PreviewWindow.tsx";
import { VisualizationChat } from "@/components/VisualizationChat.tsx";
import { CodeGenerator } from "@/utils/CodeGenerator.ts";
import { Database } from "lucide-react";
import { anthropicService } from "@/services/anthropicService.ts";
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
  html: string;
  css: string;
  javascript: string;
  fullCode: string;
  sandboxId?: string;
  sandboxUrl?: string;
  visualizationId?: string;
}
const Index = () => {
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  const [lastIsInitial, setLastIsInitial] = useState<boolean>(true);

  useEffect(() => {
    setIsAIConfigured(anthropicService.isConfigured());
  }, []);
  const handleDataFetched = (data: ApiData) => {
    setApiData(data);
    setGeneratedCode(null);
  };

  const handleVisualizationRequest = async (prompt: string, isInitial: boolean) => {
    if (!apiData) return;
    setIsGenerating(true);
    setGenerationError(null); // Clear any previous errors
    setLastPrompt(prompt); // Save for retry functionality
    setLastIsInitial(isInitial);

    try {
      let code;
      if (isInitial || !generatedCode) {
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
  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Database className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Viz Whisperer</h1>
                <p className="text-sm text-muted-foreground">
                  Build data visualizations through natural language
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

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
                <PreviewWindow
                  generatedCode={generatedCode}
                  isLoading={isGenerating}
                  error={generationError}
                  onRetry={handleRetry}
                />
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
    </div>
  );
};
export default Index;
