/**
 * Index Page
 *
 * The home page that switches between:
 * - LandingPage: for logged out users (marketing/sign-in)
 * - Dashboard: for logged in users (list of their visualizations)
 */

import { useEffect, useState } from "react";
import { LandingPage } from "@/components/LandingPage.tsx";
import { Dashboard } from "@/components/Dashboard.tsx";
import { Header } from "@/components/Header.tsx";
import { ApiKeyModal } from "@/components/ApiKeyModal.tsx";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  hasApiKey: boolean;
}

const Index = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
        }
      }
    } catch (error) {
      // Not authenticated or error - show landing page
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyUpdated = () => {
    // Refresh user info to get updated hasApiKey status
    checkAuth();
  };

  // Show loading state briefly while checking auth
  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Not logged in - show landing page
  if (!user) {
    return <LandingPage />;
  }

  // Logged in - show dashboard with header
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onOpenApiKeyModal={() => setShowApiKeyModal(true)} />
      <main className="flex-1">
        <Dashboard
          onOpenApiKeyModal={() => setShowApiKeyModal(true)}
          hasApiKey={user.hasApiKey}
        />
      </main>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        hasExistingKey={user.hasApiKey}
        onKeyUpdated={handleKeyUpdated}
      />
    </div>
  );
};

export default Index;
