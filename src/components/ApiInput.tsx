import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Sparkles } from 'lucide-react';

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

interface ApiInputProps {
  onDataFetched: (data: ApiData) => void;
  onVisualizationRequest: (prompt: string) => void;
  isGenerating: boolean;
}

export const ApiInput = ({ onDataFetched, onVisualizationRequest, isGenerating }: ApiInputProps) => {
  const [apiUrl, setApiUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentData, setCurrentData] = useState<ApiData | null>(null);
  const [visualizationPrompt, setVisualizationPrompt] = useState('');
  const { toast } = useToast();

  const fetchApiData = async () => {
    if (!apiUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid API endpoint URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Add CORS proxy for demo purposes - in production you'd handle this differently
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
      const response = await fetch(proxyUrl);
      const result = await response.json();
      
      let data;
      try {
        data = JSON.parse(result.contents);
      } catch {
        data = result.contents;
      }

      // Analyze data structure
      const analyzeData = (obj: any): any => {
        if (Array.isArray(obj)) {
          if (obj.length > 0) {
            return analyzeData(obj[0]);
          }
          return {};
        }
        return obj;
      };

      const sampleItem = analyzeData(data);
      const fields = Object.entries(sampleItem).map(([name, value]) => ({
        name,
        type: Array.isArray(value) ? 'array' : typeof value,
        sample: Array.isArray(value) ? `[${value.length} items]` : value
      }));

      const apiData: ApiData = {
        url: apiUrl,
        data,
        structure: {
          fields,
          totalRecords: Array.isArray(data) ? data.length : 1
        }
      };

      setCurrentData(apiData);
      onDataFetched(apiData);
      
      toast({
        title: "Data Fetched Successfully",
        description: `Found ${fields.length} fields with ${apiData.structure.totalRecords} records`
      });
    } catch (error) {
      toast({
        title: "Failed to Fetch Data",
        description: "Please check the URL and try again. Make sure the API supports CORS.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisualizationRequest = () => {
    if (!visualizationPrompt.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe how you want to visualize the data",
        variant: "destructive"
      });
      return;
    }

    onVisualizationRequest(visualizationPrompt);
  };

  return (
    <div className="space-y-6">
      {/* API Input Section */}
      <Card className="panel-glass p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Data Source</h2>
            <p className="text-muted-foreground text-sm">Enter a public API endpoint to analyze and visualize its data</p>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="https://api.example.com/data"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="flex-1 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && fetchApiData()}
            />
            <Button 
              onClick={fetchApiData}
              disabled={isLoading}
              variant="glow"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Data Structure Display */}
      {currentData && (
        <Card className="panel-glass p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Data Structure</h3>
              <Badge variant="secondary">{currentData.structure.totalRecords} records</Badge>
            </div>
            
            <div className="grid gap-3">
              {currentData.structure.fields.map((field, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{field.name}</span>
                    <Badge 
                      variant="outline" 
                      className={`data-${field.type === 'string' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : 'null'}`}
                    >
                      {field.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-32">
                    {String(field.sample)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Visualization Prompt */}
      {currentData && (
        <Card className="panel-glass p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Visualization Prompt</h3>
              <p className="text-muted-foreground text-sm">Describe how you want to visualize this data</p>
            </div>
            
            <Textarea
              placeholder="Create a bar chart showing the distribution of categories, with colors based on values..."
              value={visualizationPrompt}
              onChange={(e) => setVisualizationPrompt(e.target.value)}
              className="min-h-24"
            />
            
            <Button 
              onClick={handleVisualizationRequest}
              disabled={isGenerating}
              variant="secondary"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating Visualization...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Visualization
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};