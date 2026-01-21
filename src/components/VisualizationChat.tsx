import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Bot, Eye, EyeOff, Key, RefreshCw, Send, Sparkles, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast.ts";

interface VisualizationMessage {
  id: string;
  type: "user" | "system";
  content: string;
  timestamp: Date;
  isGenerating?: boolean;
}

interface VisualizationChatProps {
  hasData: boolean;
  onVisualizationRequest: (prompt: string, isInitial: boolean) => void;
  isGenerating: boolean;
  generatedCode: any;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export const VisualizationChat = ({
  hasData,
  onVisualizationRequest,
  isGenerating,
  generatedCode,
  apiKey,
  onApiKeyChange,
}: VisualizationChatProps) => {
  const [messages, setMessages] = useState<VisualizationMessage[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState(
    "Create a bar chart showing commit activity over time",
  );
  const [hasInitialVisualization, setHasInitialVisualization] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!hasData) {
      setMessages([]);
      setHasInitialVisualization(false);
      setCurrentPrompt("Create a bar chart showing commit activity over time");
    }
  }, [hasData]);

  useEffect(() => {
    if (generatedCode && !hasInitialVisualization) {
      setHasInitialVisualization(true);
      addSystemMessage(
        'Great! I\'ve created your visualization. Feel free to ask for changes like:\n• "Make it a pie chart instead"\n• "Add more colors and animations"\n• "Show the data as a line graph"\n• "Add interactive tooltips"',
      );
    }
  }, [generatedCode, hasInitialVisualization]);

  const addSystemMessage = (content: string) => {
    const systemMessage: VisualizationMessage = {
      id: Date.now().toString(),
      type: "system",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  const handleSendPrompt = () => {
    if (!currentPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please describe what you want to visualize",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Anthropic API key to generate visualizations",
        variant: "destructive",
      });
      return;
    }

    // Add user message
    const userMessage: VisualizationMessage = {
      id: Date.now().toString(),
      type: "user",
      content: currentPrompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Send the request
    onVisualizationRequest(currentPrompt, !hasInitialVisualization);
    setCurrentPrompt("");

    // Add generating message
    const generatingMessage: VisualizationMessage = {
      id: (Date.now() + 1).toString(),
      type: "system",
      content: hasInitialVisualization
        ? "I'm updating your visualization based on your feedback..."
        : "I'm analyzing your data and creating the visualization...",
      timestamp: new Date(),
      isGenerating: true,
    };
    setMessages((prev) => [...prev, generatingMessage]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  // Remove generating message when done
  useEffect(() => {
    if (!isGenerating) {
      setMessages((prev) => prev.filter((msg) => !msg.isGenerating));
    }
  }, [isGenerating]);

  const getPlaceholderText = () => {
    if (!hasInitialVisualization) {
      return "Describe how you want to visualize this data...";
    }
    return "How would you like to modify the visualization?";
  };

  const getButtonText = () => {
    if (!hasInitialVisualization) {
      return (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Visualization
        </>
      );
    }
    return (
      <>
        <RefreshCw className="w-4 h-4 mr-2" />
        Update Visualization
      </>
    );
  };

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-semibold mb-1">Ready to Visualize</h3>
          <p className="text-xs">Fetch some data first to start creating visualizations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">
            {hasInitialVisualization ? "Refine Your Visualization" : "Create Visualization"}
          </h3>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {!hasInitialVisualization && messages.length === 0 && (
            <div className="bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg p-3">
              <h4 className="font-medium mb-2 text-sm">Quick prompts:</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div>• "Bar chart of commit activity"</div>
                <div>• "Interactive pie chart"</div>
                <div>• "Line graph with animations"</div>
                <div>• "Dashboard with charts"</div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.type === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.type === "system" && (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
              )}

              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg ${
                  message.type === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
                <p className="text-[10px] opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                {message.isGenerating && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      >
                      </div>
                      <div
                        className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      >
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {message.type === "user" && (
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-secondary" />
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Section */}
      <div className="border-t border-border/50 bg-card/10 p-3 flex-shrink-0 space-y-2">
        {/* API Key Input */}
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[70px]">
            <Key className="w-3 h-3" />
            <span>API Key</span>
          </div>
          <div className="flex-1 relative">
            <Input
              type={showApiKey ? "text" : "password"}
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onApiKeyChange(e.target.value)}
              className={`pr-8 text-sm h-8 font-mono ${
                apiKey
                  ? "border-green-500/50 focus-visible:ring-green-500/30"
                  : "border-amber-500/50 focus-visible:ring-amber-500/30"
              }`}
              disabled={isGenerating}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {apiKey
            ? (
              <span className="text-xs text-green-500 flex items-center gap-1 min-w-[50px]">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Set
              </span>
            )
            : (
              <span className="text-xs text-amber-500 flex items-center gap-1 min-w-[50px]">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                Required
              </span>
            )}
        </div>

        {/* Prompt Input */}
        <div className="flex gap-2 items-stretch">
          <Textarea
            placeholder={getPlaceholderText()}
            value={currentPrompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCurrentPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 resize-none text-sm py-2 px-3"
            disabled={isGenerating}
            rows={1}
          />
          <Button
            onClick={handleSendPrompt}
            disabled={isGenerating || !currentPrompt.trim() || !apiKey.trim()}
            variant="secondary"
            className="px-6 self-stretch"
          >
            {isGenerating
              ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                    <div
                      className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    >
                    </div>
                    <div
                      className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    >
                    </div>
                  </div>
                  <span>Generating...</span>
                </div>
              )
              : (
                getButtonText()
              )}
          </Button>
        </div>

        {/* Info text */}
        <p className="text-[10px] text-muted-foreground text-center">
          Your API key is used directly in a secure sandbox and is never stored on our servers.
        </p>
      </div>
    </div>
  );
};
