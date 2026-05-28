import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px", maxWidth: "600px", margin: "0 auto",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#d4d4d8", background: "#0a0a0c", minHeight: "100vh",
        }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>
            Axiom Workspace
          </h1>
          <div style={{
            background: "#18181b", border: "1px solid #ef4444", borderRadius: "8px",
            padding: "16px", marginTop: "16px",
          }}>
            <p style={{ color: "#ef4444", fontWeight: 600, marginBottom: "8px" }}>
              Something went wrong
            </p>
            <p style={{ color: "#71717a", fontSize: "13px", marginBottom: "12px" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#27272a", border: "1px solid #3f3f46", borderRadius: "6px",
                padding: "8px 16px", color: "#d4d4d8", fontSize: "13px",
                cursor: "pointer", fontWeight: 500,
              }}
            >
              Restart App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
