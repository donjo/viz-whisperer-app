import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Play, Code, Eye, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
  fullCode: string;
}

interface PreviewWindowProps {
  generatedCode: GeneratedCode | null;
  isLoading: boolean;
}

export const PreviewWindow = ({ generatedCode, isLoading }: PreviewWindowProps) => {
  const [activeTab, setActiveTab] = useState('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (generatedCode && iframeRef.current) {
      console.log('Loading visualization into iframe...', {
        hasHtml: !!generatedCode.html,
        hasCss: !!generatedCode.css,
        hasJs: !!generatedCode.javascript,
        fullCodeLength: generatedCode.fullCode.length
      });
      
      const iframe = iframeRef.current;
      
      // Give iframe a moment to load
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          
          if (iframeDoc) {
            console.log('Writing to iframe document...');
            iframeDoc.open();
            iframeDoc.write(generatedCode.fullCode);
            iframeDoc.close();
            
            // Add error handling to the iframe
            iframe.onload = () => {
              console.log('Iframe loaded successfully');
              try {
                const iframeWindow = iframe.contentWindow;
                if (iframeWindow) {
                  // Listen for errors in the iframe
                  iframeWindow.addEventListener('error', (e) => {
                    console.error('Error in iframe:', e);
                  });
                  
                  // Check if content loaded
                  setTimeout(() => {
                    const body = iframeDoc.body;
                    if (body && body.innerHTML.trim() === '') {
                      console.warn('Iframe body is empty');
                    } else {
                      console.log('Iframe content loaded:', body?.innerHTML.substring(0, 100) + '...');
                    }
                  }, 500);
                }
              } catch (e) {
                console.error('Error setting up iframe listeners:', e);
              }
            };
            
          } else {
            console.error('Could not access iframe document');
          }
        } catch (error) {
          console.error('Error writing to iframe:', error);
        }
      }, 100);
    }
  }, [generatedCode]);

  const downloadCode = () => {
    if (!generatedCode) return;

    const blob = new Blob([generatedCode.fullCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-visualization.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Code Downloaded",
      description: "Your visualization has been saved as an HTML file"
    });
  };

  const copyToClipboard = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied to Clipboard",
      description: `${type} code copied successfully`
    });
  };

  if (isLoading) {
    return (
      <Card className="panel-glass h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Generating Visualization</h3>
            <p className="text-muted-foreground">Creating your data visualization code...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!generatedCode) {
    return (
      <Card className="panel-glass h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Eye className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Preview Window</h3>
            <p className="text-muted-foreground">Your visualization will appear here once generated</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="panel-glass h-full flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Generated Visualization</h3>
            <Badge variant="secondary">Ready</Badge>
          </div>
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
          <TabsContent value="preview" className="h-full mt-0">
            <div className="h-full rounded-lg overflow-hidden border border-border/50">
              <iframe
                ref={iframeRef}
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin"
                title="Data Visualization Preview"
              />
            </div>
          </TabsContent>

          <TabsContent value="html" className="h-full mt-0">
            <div className="relative h-full">
              <Button
                onClick={() => copyToClipboard(generatedCode.html, 'HTML')}
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
                onClick={() => copyToClipboard(generatedCode.css, 'CSS')}
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
                onClick={() => copyToClipboard(generatedCode.javascript, 'JavaScript')}
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
                onClick={() => copyToClipboard(generatedCode.fullCode, 'Full HTML')}
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
                  </div>
                </div>

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
    </Card>
  );
};