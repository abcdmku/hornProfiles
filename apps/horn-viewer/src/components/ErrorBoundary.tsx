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
          <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <h2 className="text-red-400 font-semibold">Something went wrong</h2>
            <p className="text-red-300 text-sm mt-2">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
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
