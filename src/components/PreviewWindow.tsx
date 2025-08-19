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
}

interface PreviewWindowProps {
  generatedCode: GeneratedCode | null;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const PreviewWindow = ({ generatedCode, isLoading, error, onRetry }: PreviewWindowProps) => {
  const [activeTab, setActiveTab] = useState("preview");
  const [sandboxResponse, setSandboxResponse] = useState<string>("");
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  
  // Load sandbox content from API
  const loadSandboxContent = async () => {
    if (!generatedCode?.sandboxId) return;
    
    setSandboxLoading(true);
    setSandboxError(null);
    
    try {
      // Make API call to get sandbox content
      const response = await fetch(`/api/sandbox-content?id=${generatedCode.sandboxId}`);
      
      if (!response.ok) {
        throw new Error(`Sandbox API returned ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      setSandboxResponse(html);
      console.log("Successfully loaded content from sandbox:", generatedCode.sandboxId);
    } catch (error) {
      console.error("Failed to load sandbox content:", error);
      setSandboxError(error instanceof Error ? error.message : "Failed to load sandbox");
    } finally {
      setSandboxLoading(false);
    }
  };

  const loadIframeContent = () => {
    if (!generatedCode || !iframeRef.current) return;
    
    console.log("Loading visualization into iframe...", {
      hasHtml: !!generatedCode.html,
      hasCss: !!generatedCode.css,
      hasJs: !!generatedCode.javascript,
      fullCodeLength: generatedCode.fullCode.length,
    });

    const iframe = iframeRef.current;
    
    try {
      console.log("Using data URL method to load iframe content...");
      const dataUrl = `data:text/html;charset=utf-8,${
        encodeURIComponent(generatedCode.fullCode)
      }`;
      
      // Clean up any existing event listeners
      iframe.onload = null;
      iframe.onerror = null;
      
      // Set up event-driven loading
      iframe.onload = () => {
        console.log("Iframe loaded successfully via data URL");
        
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            const canvases = iframeDoc.body.querySelectorAll("canvas");
            const scripts = iframeDoc.body.querySelectorAll("script");
            console.log(`Content check: ${canvases.length} canvas(es), ${scripts.length} script(s)`);
            
            if (canvases.length === 0) {
              console.warn("No canvas elements found in iframe");
            } else {
              console.log("Canvas elements detected - chart should be rendering");
            }
          }
        } catch (checkError) {
          console.error("Error checking iframe content:", checkError);
        }
      };
      
      iframe.onerror = (e) => {
        console.error("Iframe loading error:", e);
      };
      
      // Load the content
      iframe.src = dataUrl;
      
    } catch (error) {
      console.error("Failed to load iframe with data URL:", error);
    }
  };

  useEffect(() => {
    if (generatedCode) {
      // Prefer sandbox rendering if available, fallback to iframe
      if (generatedCode.sandboxId) {
        loadSandboxContent();
      } else {
        loadIframeContent();
      }
    }
  }, [generatedCode]);

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
              {generatedCode.sandboxId ? (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Sandbox
                </Badge>
              ) : (
                <Badge variant="secondary">iframe</Badge>
              )}
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
            {generatedCode.sandboxId && generatedCode.sandboxUrl && (
              <Button
                onClick={() => {
                  if (generatedCode.sandboxUrl?.startsWith('https://')) {
                    // Try to open the sandbox URL, but warn about potential issues
                    navigator.clipboard.writeText(generatedCode.sandboxUrl);
                    toast({
                      title: "Sandbox URL Copied",
                      description: "Note: Sandbox URLs may take a moment to become accessible or may be in development mode.",
                    });
                    // Still try to open it
                    window.open(generatedCode.sandboxUrl, '_blank');
                  } else {
                    // Development/local URL - show info toast
                    toast({
                      title: "Development Mode",
                      description: `Sandbox URL: ${generatedCode.sandboxUrl}`,
                    });
                  }
                }}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Sandbox
              </Button>
            )}
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
          {/* Preview content - prefer sandbox over iframe */}
          <div className={`h-full rounded-lg overflow-hidden border border-border/50 ${activeTab === 'preview' ? 'block' : 'hidden'}`}>
            {generatedCode?.sandboxId ? (
              <div className="w-full h-full">
                {sandboxLoading ? (
                  <div className="w-full h-full flex items-center justify-center bg-background">
                    <div className="text-center space-y-4">
                      <div className="w-8 h-8 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                        <ExternalLink className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Loading sandbox visualization...</p>
                    </div>
                  </div>
                ) : sandboxError ? (
                  <div className="w-full h-full flex items-center justify-center bg-background">
                    <div className="text-center space-y-4">
                      <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Sandbox Error</p>
                        <p className="text-xs text-muted-foreground">{sandboxError}</p>
                        <p className="text-xs text-muted-foreground mt-2">Falling back to iframe...</p>
                      </div>
                    </div>
                  </div>
                ) : sandboxResponse ? (
                  <iframe
                    className="w-full h-full"
                    srcDoc={sandboxResponse}
                    sandbox="allow-scripts allow-same-origin"
                    title="Sandbox Visualization Preview"
                  />
                ) : null}
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin"
                title="Data Visualization Preview"
              />
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
                    {generatedCode.sandboxId && (
                      <>
                        <div className="bg-muted/30 p-2 rounded">
                          <strong>Sandbox ID:</strong> {generatedCode.sandboxId}
                        </div>
                        <div className="bg-muted/30 p-2 rounded">
                          <strong>Sandbox URL:</strong> {generatedCode.sandboxUrl || 'N/A'}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {generatedCode.sandboxId && (
                  <div>
                    <h4 className="font-medium mb-2">🏖️ Sandbox Info</h4>
                    <div className="space-y-2 text-xs">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        <strong>Rendering Mode:</strong> Deno Sandbox
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        <strong>Security:</strong> Fully isolated execution environment
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        <strong>Status:</strong> {sandboxLoading ? 'Loading...' : sandboxError ? 'Error' : sandboxResponse ? 'Ready' : 'Initializing'}
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        <strong>Sandbox URL:</strong> 
                        <br />
                        <code className="text-xs break-all">
                          {generatedCode.sandboxUrl}
                        </code>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                        <strong>Note:</strong> Visualization is running in a real Deno Deploy sandbox. The URL is generated but may not be publicly accessible yet (this is a known issue with the sandbox API).
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">🚨 Common Issues</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Check browser console for JavaScript errors</li>
                    <li>• Verify all HTML tags are properly closed</li>
                    <li>• Check if data is properly loaded in JavaScript</li>
                    <li>• Look for CSS conflicts or missing styles</li>
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
