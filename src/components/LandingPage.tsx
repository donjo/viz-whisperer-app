/**
 * Landing Page Component
 *
 * Shown to users who are not logged in.
 * Simple, minimalist sign-in page.
 */

import { BarChart3, Github } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-8">
          {/* Logo and title */}
          <div className="flex flex-col items-center gap-4">
            <BarChart3 className="w-16 h-16 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Viz Whisperer</h1>
              <p className="text-muted-foreground mt-1">
                Data visualizations through natural language
              </p>
            </div>
          </div>

          {/* CTA */}
          <Button asChild size="lg">
            <a href="/api/auth/login">
              <Github className="w-5 h-5 mr-2" />
              Sign in with GitHub
            </a>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6">
        <div className="text-center text-sm text-muted-foreground">
          <p>Bring your own Anthropic API key</p>
        </div>
      </footer>
    </div>
  );
}
