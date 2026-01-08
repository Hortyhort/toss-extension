import React, { Component, type ReactNode } from "react"
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Something went wrong</h3>
            <p className="text-xs truncate" title={this.state.error?.message}>
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs font-medium underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
