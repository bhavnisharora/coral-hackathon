"use client";
import DashboardCards from "./components/DashboardCards";
import BugAnalyzer from "./components/BugAnalyzer";
import PRTable from "./components/PRTable";

export default function Home() {
  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <nav style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        padding: "0 32px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "linear-gradient(135deg, #388bfd, #a371f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px #388bfd55", flexShrink: 0
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            Bug Pilot
          </span>
          <span style={{
            background: "#388bfd22",
            color: "var(--accent-blue)",
            fontSize: "11px",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "20px",
            border: "1px solid #388bfd44",
            marginLeft: "4px"
          }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            width: "8px", height: "8px",
            background: "var(--accent-green)",
            borderRadius: "50%",
            display: "inline-block",
            boxShadow: "0 0 6px var(--accent-green)"
          }} />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>AI Online</span>
        </div>
      </nav>

      {/* Page Content */}
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          {/* <h1 style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.5px",
            marginBottom: "6px"
          }}>
            Bug Pilot Dashboard
          </h1> */}
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            AI analyzes recently merged PRs and pinpoints which one introduced the bug.
          </p>
        </div>

        <DashboardCards />
        <BugAnalyzer />
        <PRTable />
      </main>
    </div>
  );
}
