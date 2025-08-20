import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { AlertCircle, Code, Copy, Download, Eye, Play, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast.ts";

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
  fullCode: string;
  sandboxId?: string;
  sandboxUrl?: string;
  visualizationId?: string;
}

interface DeploymentStatus {
  visualizationId: string;
  status: 'pending' | 'deploying' | 'verifying' | 'ready' | 'failed';
  startTime: string;
  endTime?: string;
  sandboxId?: string;
  sandboxUrl?: string;
  error?: string;
  events: Array<{
    id: string;
    timestamp: string;
    stage: string;
    message: string;
    details?: any;
    error?: string;
  }>;
}

interface PreviewWindowProps {
  generatedCode: GeneratedCode | null;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const PreviewWindow = ({ generatedCode, isLoading, error, onRetry }: PreviewWindowProps) => {
  console.log('🔍 PreviewWindow received:', {
    hasVisualizationId: !!generatedCode?.visualizationId,
    visualizationId: generatedCode?.visualizationId,
    generatedCode: generatedCode
  });
  
  const [activeTab, setActiveTab] = useState("preview");
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Monitor deployment status
  const monitorDeployment = async (visualizationId: string) => {
    const maxChecks = 30; // 30 checks = ~2 minutes max
    const checkInterval = 4000; // 4 seconds
    
    for (let check = 1; check <= maxChecks; check++) {
      try {
        const response = await fetch(`/api/deployment-status?id=${visualizationId}`);
        
        if (!response.ok) {
          throw new Error(`Status API returned ${response.status}: ${response.statusText}`);
        }
        
        const status: DeploymentStatus = await response.json();
        setDeploymentStatus(status);
        
        console.log(`🔍 Deployment check ${check}/${maxChecks}:`, status.status, status.events[status.events.length - 1]?.message);
        
        // Stop monitoring if deployment is complete
        if (status.status === 'ready' || status.status === 'failed') {
          if (status.status === 'failed') {
            setDeploymentError(status.error || 'Deployment failed');
          }
          break;
        }
        
        // Wait before next check (unless it's the last check)
        if (check < maxChecks) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
      } catch (error) {
        console.error(`Error checking deployment status (attempt ${check}):`, error);
        setDeploymentError(error instanceof Error ? error.message : "Failed to check deployment status");
        break;
      }
    }
  };

  useEffect(() => {
    if (generatedCode?.visualizationId) {
      // Start monitoring deployment status
      setDeploymentStatus(null);
      setDeploymentError(null);
      monitorDeployment(generatedCode.visualizationId);
    }
  }, [generatedCode?.visualizationId]);

  const downloadCode = () => {
    if (!generatedCode) return;

    const blob = new Blob([generatedCode.fullCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-visualization.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Code Downloaded",
      description: "Your visualization has been saved as an HTML file",
    });
  };

  const copyToClipboard = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied to Clipboard",
      description: `${type} code copied successfully`,
    });
  };

  if (isLoading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Generating Visualization</h3>
            <p className="text-muted-foreground">Creating your data visualization code...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-destructive">Generation Failed</h3>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="mt-4">
                <Play className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!generatedCode) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Eye className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Preview Window</h3>
            <p className="text-muted-foreground">
              Your visualization will appear here once generated
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Generated Visualization</h3>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Sandbox Deploy
              </Badge>
            </div>
            {generatedCode.sandboxId && generatedCode.sandboxUrl && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Sandbox URL:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {generatedCode.sandboxUrl}
                </code>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCode.sandboxUrl || '');
                    const isProductionUrl = generatedCode.sandboxUrl?.startsWith('https://');
                    toast({
                      title: "URL Copied",
                      description: isProductionUrl 
                        ? "Production sandbox URL copied to clipboard"
                        : "Development sandbox URL copied to clipboard"
                    });
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={downloadCode}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 mx-4 mt-4 max-w-full overflow-hidden text-xs">
          <TabsTrigger value="preview">
            <Eye className="w-3 h-3 mr-1" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
          <TabsTrigger value="js">JavaScript</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <div className="flex-1 p-4">
          {/* Preview content - load directly from sandbox deployment */}
          <div className={`h-full rounded-lg overflow-hidden border border-border/50 ${activeTab === 'preview' ? 'block' : 'hidden'}`}>
            {deploymentError || deploymentStatus?.status === 'failed' ? (
              <div className="w-full h-full flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                  <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Deployment Failed</p>
                    <p className="text-xs text-muted-foreground">{deploymentError || deploymentStatus?.error}</p>
                    <p className="text-xs text-muted-foreground mt-2">Visualization must be deployed to sandbox to view</p>
                    {onRetry && (
                      <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
                        <Play className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : deploymentStatus?.status === 'ready' && deploymentStatus?.sandboxUrl ? (
              <iframe
                className="w-full h-full"
                src={deploymentStatus.sandboxUrl}
                sandbox="allow-scripts allow-same-origin"
                title="Sandbox Deployed Visualization"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                  <div className="w-8 h-8 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                    <ExternalLink className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {!deploymentStatus ? 'Starting deployment...' :
                       deploymentStatus.status === 'pending' ? 'Generation complete, awaiting sandbox deployment' :
                       deploymentStatus.status === 'deploying' ? 'Deploying to sandbox...' :
                       deploymentStatus.status === 'verifying' ? 'Verifying deployment...' :
                       'Finalizing deployment...'}
                    </p>
                    {deploymentStatus?.events?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {deploymentStatus.events[deploymentStatus.events.length - 1]?.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <TabsContent value="preview" className="h-full mt-0">
            {/* This is just a placeholder to maintain tab structure */}
          </TabsContent>

          <TabsContent value="html" className="h-full mt-0">
            <div className="relative h-full">
              <Button
                onClick={() => copyToClipboard(generatedCode.html, "HTML")}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <pre className="code-panel h-full p-4 overflow-auto text-sm">
                <code className="text-foreground">{generatedCode.html}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="css" className="h-full mt-0">
            <div className="relative h-full">
              <Button
                onClick={() => copyToClipboard(generatedCode.css, "CSS")}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <pre className="code-panel h-full p-4 overflow-auto text-sm">
                <code className="text-foreground">{generatedCode.css}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="js" className="h-full mt-0">
            <div className="relative h-full">
              <Button
                onClick={() => copyToClipboard(generatedCode.javascript, "JavaScript")}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <pre className="code-panel h-full p-4 overflow-auto text-sm">
                <code className="text-foreground">{generatedCode.javascript}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="debug" className="h-full mt-0">
            <div className="relative h-full">
              <Button
                onClick={() => copyToClipboard(generatedCode.fullCode, "Full HTML")}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <div className="h-full overflow-auto text-sm space-y-4 p-4">
                <div>
                  <h4 className="font-medium mb-2">📊 Full HTML Document</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    This is exactly what gets loaded into the iframe
                  </p>
                  <pre className="bg-muted/30 p-3 rounded text-xs overflow-auto max-h-60">
                    <code>{generatedCode.fullCode}</code>
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">🔍 Debug Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/30 p-2 rounded">
                      <strong>HTML Length:</strong> {generatedCode.html.length} chars
                    </div>
                    <div className="bg-muted/30 p-2 rounded">
                      <strong>CSS Length:</strong> {generatedCode.css.length} chars
                    </div>
                    <div className="bg-muted/30 p-2 rounded">
                      <strong>JS Length:</strong> {generatedCode.javascript.length} chars
                    </div>
                    <div className="bg-muted/30 p-2 rounded">
                      <strong>Total Length:</strong> {generatedCode.fullCode.length} chars
                    </div>
                    <div className="bg-muted/30 p-2 rounded">
                      <strong>Sandbox ID:</strong> {generatedCode.sandboxId || 'N/A'}
                    </div>
                    <div className="bg-muted/30 p-2 rounded">
                      <strong>Sandbox URL:</strong> {generatedCode.sandboxUrl || 'N/A'}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">🏖️ Sandbox Deployment</h4>
                  <div className="space-y-2 text-xs">
                    <div className="bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-2 rounded">
                      <strong className="text-blue-900 dark:text-blue-100">Rendering Mode:</strong> <span className="text-blue-800 dark:text-blue-200">Deno Deploy Sandbox (Required)</span>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-2 rounded">
                      <strong className="text-blue-900 dark:text-blue-100">Security:</strong> <span className="text-blue-800 dark:text-blue-200">Fully isolated execution environment</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2 rounded">
                      <strong className="text-slate-900 dark:text-slate-100">Status:</strong> <span className="text-slate-800 dark:text-slate-200">{
                        deploymentError || deploymentStatus?.status === 'failed' ? '❌ Failed' :
                        deploymentStatus?.status === 'ready' ? '✅ Ready' :
                        deploymentStatus?.status === 'verifying' ? '🔍 Verifying' :
                        deploymentStatus?.status === 'deploying' ? '🚀 Deploying' :
                        deploymentStatus?.status === 'pending' ? '⏳ Pending' :
                        '🔄 Initializing'
                      }</span>
                    </div>
                    <div className="bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2 rounded">
                      <strong className="text-amber-900 dark:text-amber-100">Sandbox URL:</strong> 
                      <br />
                      <code className="text-xs break-all bg-amber-200 dark:bg-amber-900/30 px-1 py-0.5 rounded text-amber-900 dark:text-amber-100">
                        {deploymentStatus?.sandboxUrl || generatedCode.sandboxUrl || 'Not available'}
                      </code>
                    </div>
                    <div className="bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-2 rounded">
                      <strong className="text-green-900 dark:text-green-100">Deployment:</strong> <span className="text-green-800 dark:text-green-200">All visualizations are deployed to live Deno Deploy sandboxes. No local rendering.</span>
                    </div>
                    {deploymentStatus?.events && deploymentStatus.events.length > 0 && (
                      <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2 rounded">
                        <strong className="text-slate-900 dark:text-slate-100">Recent Events:</strong>
                        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                          {deploymentStatus.events.slice(-5).map((event) => (
                            <div key={event.id} className="text-xs">
                              <span className="font-mono text-slate-600 dark:text-slate-400">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                              <span className="ml-2 text-slate-800 dark:text-slate-200">{event.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">🚨 Troubleshooting</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Ensure DENO_DEPLOY_TOKEN is configured for sandbox deployment</li>
                    <li>• Check if sandbox URL is accessible and responding</li>
                    <li>• Verify visualization code generates valid HTML/CSS/JS</li>
                    <li>• Look for deployment errors in server logs</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
