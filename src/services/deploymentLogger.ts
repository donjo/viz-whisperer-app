// Configuration constants
const CONFIG = {
  CLEANUP: {
    OLD_LOG_THRESHOLD_MS: 60 * 60 * 1000, // 1 hour
  },
  TIME_DISPLAY: {
    SECONDS_PER_MINUTE: 60,
  },
} as const;

interface DeploymentEvent {
  id: string;
  timestamp: Date;
  stage: "generation" | "sandbox_creation" | "deployment" | "verification" | "ready" | "error";
  message: string;
  details?: any;
  error?: string;
}

interface DeploymentLog {
  visualizationId: string;
  startTime: Date;
  endTime?: Date;
  status: "pending" | "deploying" | "verifying" | "ready" | "failed";
  events: DeploymentEvent[];
  sandboxId?: string;
  sandboxUrl?: string;
  error?: string;
}

class DeploymentLogger {
  private logs = new Map<string, DeploymentLog>();
  private listeners = new Map<string, ((log: DeploymentLog) => void)[]>();

  /**
   * Start tracking a new deployment
   */
  startDeployment(visualizationId: string): DeploymentLog {
    const log: DeploymentLog = {
      visualizationId,
      startTime: new Date(),
      status: "pending",
      events: [],
    };

    this.logs.set(visualizationId, log);
    this.logEvent(visualizationId, "generation", "Visualization generation started");

    console.log(`📊 Starting deployment tracking for visualization: ${visualizationId}`);
    return log;
  }

  /**
   * Log an event in the deployment process
   */
  logEvent(
    visualizationId: string,
    stage: DeploymentEvent["stage"],
    message: string,
    details?: any,
    error?: string,
  ): void {
    const log = this.logs.get(visualizationId);
    if (!log) {
      console.warn(`No deployment log found for visualization: ${visualizationId}`, {
        visualizationId,
        stage,
        message,
        availableLogs: Array.from(this.logs.keys()),
      });
      return;
    }

    const event: DeploymentEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      stage,
      message,
      details,
      error,
    };

    log.events.push(event);

    // Update overall status based on stage
    switch (stage) {
      case "generation":
        log.status = "pending";
        break;
      case "sandbox_creation":
      case "deployment":
        log.status = "deploying";
        break;
      case "verification":
        log.status = "verifying";
        break;
      case "ready":
        log.status = "ready";
        log.endTime = new Date();
        break;
      case "error":
        log.status = "failed";
        log.endTime = new Date();
        log.error = error || message;
        break;
    }

    // Enhanced console logging with emojis and formatting
    const emoji = this.getStageEmoji(stage);
    const duration = this.getDuration(log.startTime);

    if (error) {
      console.error(`${emoji} [${duration}] ${visualizationId}: ${message}`, error);
      if (details) console.error("Details:", details);
    } else {
      console.log(`${emoji} [${duration}] ${visualizationId}: ${message}`);
      if (details) console.log("Details:", details);
    }

    // Notify listeners
    this.notifyListeners(visualizationId, log);
  }

  /**
   * Set sandbox information for a deployment
   */
  setSandboxInfo(visualizationId: string, sandboxId: string, sandboxUrl: string): void {
    const log = this.logs.get(visualizationId);
    if (log) {
      log.sandboxId = sandboxId;
      log.sandboxUrl = sandboxUrl;
      this.logEvent(visualizationId, "sandbox_creation", `Sandbox created successfully`, {
        sandboxId,
        sandboxUrl,
      });
    }
  }

  /**
   * Mark deployment as ready after verification
   */
  markReady(visualizationId: string): void {
    this.logEvent(visualizationId, "ready", "Deployment verified and ready for viewing");
  }

  /**
   * Mark deployment as failed
   */
  markFailed(visualizationId: string, error: string, details?: any): void {
    this.logEvent(visualizationId, "error", "Deployment failed", details, error);
  }

  /**
   * Get the current deployment log
   */
  getLog(visualizationId: string): DeploymentLog | undefined {
    return this.logs.get(visualizationId);
  }

  /**
   * Subscribe to deployment updates
   */
  onDeploymentUpdate(visualizationId: string, callback: (log: DeploymentLog) => void): () => void {
    if (!this.listeners.has(visualizationId)) {
      this.listeners.set(visualizationId, []);
    }

    this.listeners.get(visualizationId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(visualizationId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get deployment statistics
   */
  getStats(): {
    total: number;
    pending: number;
    deploying: number;
    verifying: number;
    ready: number;
    failed: number;
    averageDeployTime?: number;
  } {
    const logs = Array.from(this.logs.values());
    const stats = {
      total: logs.length,
      pending: 0,
      deploying: 0,
      verifying: 0,
      ready: 0,
      failed: 0,
    };

    const completedDeployments: number[] = [];

    logs.forEach((log) => {
      stats[log.status]++;

      if (log.endTime && log.status === "ready") {
        completedDeployments.push(log.endTime.getTime() - log.startTime.getTime());
      }
    });

    const averageDeployTime = completedDeployments.length > 0
      ? completedDeployments.reduce((a, b) => a + b, 0) / completedDeployments.length
      : undefined;

    return { ...stats, averageDeployTime };
  }

  /**
   * Clean up old deployment logs (older than 1 hour)
   */
  cleanup(): void {
    const oneHourAgo = new Date(Date.now() - CONFIG.CLEANUP.OLD_LOG_THRESHOLD_MS);
    const toDelete: string[] = [];

    for (const [id, log] of this.logs) {
      if (log.startTime < oneHourAgo) {
        toDelete.push(id);
      }
    }

    toDelete.forEach((id) => {
      this.logs.delete(id);
      this.listeners.delete(id);
    });

    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} old deployment logs`);
    }
  }

  private getStageEmoji(stage: DeploymentEvent["stage"]): string {
    const emojis = {
      generation: "🎨",
      sandbox_creation: "🏗️",
      deployment: "🚀",
      verification: "✅",
      ready: "🎯",
      error: "❌",
    };
    return emojis[stage] || "📝";
  }

  private getDuration(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < CONFIG.TIME_DISPLAY.SECONDS_PER_MINUTE) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / CONFIG.TIME_DISPLAY.SECONDS_PER_MINUTE);
      const remainingSeconds = seconds % CONFIG.TIME_DISPLAY.SECONDS_PER_MINUTE;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  private notifyListeners(visualizationId: string, log: DeploymentLog): void {
    const callbacks = this.listeners.get(visualizationId);
    if (callbacks) {
      callbacks.forEach((callback, index) => {
        try {
          callback(log);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Error in deployment listener:", errorMessage, {
            visualizationId,
            listenerIndex: index,
            callbackCount: callbacks.length,
            logStatus: log.status,
            originalError: error,
          });
        }
      });
    }
  }
}

// Export singleton instance
export const deploymentLogger = new DeploymentLogger();

// Export types
export type { DeploymentEvent, DeploymentLog };
