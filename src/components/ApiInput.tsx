import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { useToast } from "@/hooks/use-toast.ts";
import { Loader2 } from "lucide-react";

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
}

export const ApiInput = (
  { onDataFetched }: ApiInputProps,
) => {
  const [apiUrl, setApiUrl] = useState(
    "https://api.github.com/repos/denoland/deno/contributors",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [currentData, setCurrentData] = useState<ApiData | null>(null);
  const { toast } = useToast();

  const fetchApiData = async () => {
    if (!apiUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid API endpoint URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Try direct fetch first (for CORS-enabled APIs like GitHub)
      let response;
      let data;

      try {
        response = await fetch(apiUrl);
        data = await response.json();
      } catch (corsError) {
        // Fallback to CORS proxy for non-CORS enabled APIs
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
        response = await fetch(proxyUrl);
        const result = await response.json();

        try {
          data = JSON.parse(result.contents);
        } catch {
          data = result.contents;
        }
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
        type: Array.isArray(value) ? "array" : typeof value,
        sample: Array.isArray(value) ? `[${value.length} items]` : value,
      }));

      const apiData: ApiData = {
        url: apiUrl,
        data,
        structure: {
          fields,
          totalRecords: Array.isArray(data) ? data.length : 1,
        },
      };

      setCurrentData(apiData);
      onDataFetched(apiData);

      toast({
        title: "Data Fetched Successfully",
        description: `Found ${fields.length} fields with ${apiData.structure.totalRecords} records`,
      });
    } catch (error) {
      toast({
        title: "Failed to Fetch Data",
        description: "Please check the URL and try again. Make sure the API supports CORS.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* API Input Section */}
      <Card className="panel-glass p-6 flex-shrink-0">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Data Source</h2>
            <p className="text-muted-foreground text-sm">
              Enter a public API endpoint to analyze and visualize its data
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="https://api.example.com/data"
              value={apiUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiUrl(e.target.value)}
              className="flex-1 font-mono text-sm"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                e.key === "Enter" && fetchApiData()}
            />
            <Button
              onClick={fetchApiData}
              disabled={isLoading}
              variant="default"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Data Structure Display */}
      {currentData && (
        <Card className="panel-glass p-6 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold">Data Structure</h3>
            <Badge variant="secondary">
              {currentData.structure.totalRecords} records
            </Badge>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="grid gap-3 pr-4">
                {currentData.structure.fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">{field.name}</span>
                      <Badge
                        variant="outline"
                        className={`data-${
                          field.type === "string"
                            ? "string"
                            : field.type === "number"
                            ? "number"
                            : field.type === "boolean"
                            ? "boolean"
                            : "null"
                        }`}
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
            </ScrollArea>
          </div>
        </Card>
      )}
    </div>
  );
};
