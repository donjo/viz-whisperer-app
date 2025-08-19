import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, RefreshCw, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VisualizationMessage {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  isGenerating?: boolean;
}

interface VisualizationChatProps {
  hasData: boolean;
  onVisualizationRequest: (prompt: string, isInitial: boolean) => void;
  isGenerating: boolean;
  generatedCode: any;
}

export const VisualizationChat = ({ 
  hasData, 
  onVisualizationRequest, 
  isGenerating,
  generatedCode 
}: VisualizationChatProps) => {
  const [messages, setMessages] = useState<VisualizationMessage[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('Create a bar chart showing commit activity over time');
  const [hasInitialVisualization, setHasInitialVisualization] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!hasData) {
      setMessages([]);
      setHasInitialVisualization(false);
      setCurrentPrompt('Create a bar chart showing commit activity over time');
    }
  }, [hasData]);

  useEffect(() => {
    if (generatedCode && !hasInitialVisualization) {
      setHasInitialVisualization(true);
      addSystemMessage("Great! I've created your visualization. Feel free to ask for changes like:\n• \"Make it a pie chart instead\"\n• \"Add more colors and animations\"\n• \"Show the data as a line graph\"\n• \"Add interactive tooltips\"");
    }
  }, [generatedCode, hasInitialVisualization]);

  const addSystemMessage = (content: string) => {
    const systemMessage: VisualizationMessage = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, systemMessage]);
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

    // Add user message
    const userMessage: VisualizationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentPrompt,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send the request
    onVisualizationRequest(currentPrompt, !hasInitialVisualization);
    setCurrentPrompt('');

    // Add generating message
    const generatingMessage: VisualizationMessage = {
      id: (Date.now() + 1).toString(),
      type: 'system',
      content: hasInitialVisualization 
        ? 'I\'m updating your visualization based on your feedback...'
        : 'I\'m analyzing your data and creating the visualization...',
      timestamp: new Date(),
      isGenerating: true
    };
    setMessages(prev => [...prev, generatingMessage]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  // Remove generating message when done
  useEffect(() => {
    if (!isGenerating) {
      setMessages(prev => prev.filter(msg => !msg.isGenerating));
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
      <Card className="panel-glass p-6">
        <div className="text-center text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Ready to Visualize</h3>
          <p>Fetch some data first to start creating visualizations</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="panel-glass h-full flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {hasInitialVisualization ? 'Refine Your Visualization' : 'Create Visualization'}
          </h3>
          {hasInitialVisualization && (
            <Badge variant="outline">Interactive</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {hasInitialVisualization 
            ? 'Describe changes to improve your visualization'
            : 'Describe how you want to visualize your data'
          }
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {!hasInitialVisualization && messages.length === 0 && (
            <div className="bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg p-4">
              <h4 className="font-medium mb-2">💡 Try these prompts:</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>• "Create a bar chart showing commit activity over time"</div>
                <div>• "Build an interactive pie chart with the data"</div>
                <div>• "Make a line graph with animated transitions"</div>
                <div>• "Create a dashboard with multiple chart types"</div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'system' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {message.isGenerating && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-secondary" />
                </div>
              )}
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="space-y-3">
          <Textarea
            placeholder={getPlaceholderText()}
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            className="min-h-[60px] resize-none"
            disabled={isGenerating}
          />
          <Button
            onClick={handleSendPrompt}
            disabled={isGenerating || !currentPrompt.trim()}
            variant="secondary"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>Generating...</span>
                </div>
              </>
            ) : (
              getButtonText()
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};