/**
 * Header Component
 *
 * Displays the app logo, navigation, and user menu.
 * Shows different content based on authentication state.
 */

import { BarChart3, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";

// User info from the /api/auth/me endpoint
interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  hasApiKey: boolean;
}

interface HeaderProps {
  user: UserInfo | null;
  onOpenApiKeyModal?: () => void;
}

export function Header({ user, onOpenApiKeyModal }: HeaderProps) {
  // Get initials for avatar fallback (first letter of first and last name)
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and title */}
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <BarChart3 className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Viz Whisperer</h1>
              <p className="text-xs text-muted-foreground">
                Data visualizations through natural language
              </p>
            </div>
          </a>

          {/* Right side - auth or user menu */}
          <div className="flex items-center gap-4">
            {user
              ? (
                <>
                  {/* New Visualization button */}
                  <Button asChild variant="default" size="sm">
                    <a href="/create">New Visualization</a>
                  </Button>

                  {/* User dropdown menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <a href="/" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          <span>Dashboard</span>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={onOpenApiKeyModal}
                        className="cursor-pointer"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>API Key Settings</span>
                        {!user.hasApiKey && (
                          <span className="ml-auto text-xs text-amber-500">Not set</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <a href="/api/auth/logout" className="cursor-pointer text-destructive">
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Sign out</span>
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )
              : (
                /* Sign in button for logged out users */
                <Button asChild variant="default" size="sm">
                  <a href="/api/auth/login">Sign in with GitHub</a>
                </Button>
              )}
          </div>
        </div>
      </div>
    </header>
  );
}
