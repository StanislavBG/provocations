import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

async function init() {
  const root = createRoot(document.getElementById("root")!);

  try {
    const res = await fetch("/api/clerk-config");
    if (!res.ok) {
      throw new Error(`Failed to fetch config: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Invalid response format from config endpoint");
    }

    const { publishableKey } = await res.json();

    if (!publishableKey) {
      throw new Error("Missing Clerk publishable key in server config");
    }

    root.render(
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    );
  } catch (error) {
    console.error("Failed to initialize Clerk:", error);
    root.render(
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Unable to load authentication</h1>
          <p style={{ color: "#666", marginBottom: "1rem" }}>Please try again or refresh the page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "0.5rem 1.5rem", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer", background: "#f5f5f5" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}

init();
