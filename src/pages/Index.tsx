import { useState } from 'react';
import { ApiInput } from '@/components/ApiInput';
import { PreviewWindow } from '@/components/PreviewWindow';

import { CodeGenerator } from '@/utils/CodeGenerator';
import { Badge } from '@/components/ui/badge';
import { Database, Sparkles } from 'lucide-react';

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
}

const Index = () => {
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatProcessing, setIsChatProcessing] = useState(false);

  const handleDataFetched = (data: ApiData) => {
    setApiData(data);
    setGeneratedCode(null); // Clear previous visualization
  };

  const handleVisualizationRequest = async (prompt: string) => {
    if (!apiData) return;

    setIsGenerating(true);
    try {
      const code = await CodeGenerator.generateVisualization(apiData, prompt);
      setGeneratedCode(code);
    } catch (error) {
      console.error('Failed to generate visualization:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatMessage = async (message: string) => {
    if (!apiData || !generatedCode) return;

    setIsChatProcessing(true);
    try {
      const updatedCode = await CodeGenerator.iterateVisualization(
        generatedCode,
        message,
        apiData
      );
      setGeneratedCode(updatedCode);
    } catch (error) {
      console.error('Failed to iterate visualization:', error);
    } finally {
      setIsChatProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Database className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Vibe Coding</h1>
                <p className="text-sm text-muted-foreground">Data Explorer & Visualization Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:flex">
                <Sparkles className="w-3 h-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Input */}
          <div>
            <ApiInput
              onDataFetched={handleDataFetched}
              onVisualizationRequest={handleVisualizationRequest}
              isGenerating={isGenerating}
            />
          </div>

          {/* Right Panel - Preview */}
          <div className="h-full">
            <PreviewWindow
              generatedCode={generatedCode}
              isLoading={isGenerating}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
