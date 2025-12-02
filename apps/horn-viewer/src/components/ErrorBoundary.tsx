import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="glass-panel rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
            <h2 className="text-lg font-display text-red-100">Something went wrong</h2>
            <p className="text-sm text-red-100/80 mt-2">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-100 hover:border-red-300/80 transition"
            >
              Reset
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
