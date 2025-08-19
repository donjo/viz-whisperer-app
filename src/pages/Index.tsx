import { useState, useEffect } from 'react';
import { ApiInput } from '@/components/ApiInput';
import { PreviewWindow } from '@/components/PreviewWindow';
import { VisualizationChat } from '@/components/VisualizationChat';
import { CodeGenerator } from '@/utils/CodeGenerator';
import { Badge } from '@/components/ui/badge';
import { Database, Sparkles, AlertCircle } from 'lucide-react';
import { anthropicService } from '@/services/anthropicService';
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
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  
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
    try {
      let code;
      if (isInitial || !generatedCode) {
        code = await CodeGenerator.generateVisualization(apiData, prompt);
      } else {
        code = await CodeGenerator.iterateVisualization(generatedCode, prompt, apiData);
      }
      setGeneratedCode(code);
    } catch (error) {
      console.error('Failed to generate visualization:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Database className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Vibe Vizing</h1>
                <p className="text-sm text-muted-foreground">Build data visualizations with custom controls</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAIConfigured ? (
                <Badge variant="outline" className="hidden sm:flex">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI-Powered (Live)
                </Badge>
              ) : (
                <Badge variant="secondary" className="hidden sm:flex">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Demo Mode
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <div className="grid xl:grid-cols-3 lg:grid-cols-2 gap-6 h-[calc(100vh-180px)]">
          {/* Left Panel - Data Input */}
          <div className="lg:col-span-1">
            <ApiInput onDataFetched={handleDataFetched} />
          </div>

          {/* Middle Panel - Visualization Chat */}
          <div className="lg:col-span-1 xl:col-span-1">
            <VisualizationChat 
              hasData={!!apiData}
              onVisualizationRequest={handleVisualizationRequest}
              isGenerating={isGenerating}
              generatedCode={generatedCode}
            />
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2 xl:col-span-1">
            <PreviewWindow generatedCode={generatedCode} isLoading={isGenerating} />
          </div>
        </div>
      </main>
    </div>;
};
export default Index;