"use client";

import { useEffect, useState } from "react";
import API from "../services/api";

const riskMeta = (score) => {
  if (score >= 7) return { color: "#f85149", bg: "#f8514915", border: "#f8514933", label: "HIGH" };
  if (score >= 4) return { color: "#d29922", bg: "#d2992215", border: "#d2992233", label: "MED" };
  return { color: "#3fb950", bg: "#3fb95015", border: "#3fb95033", label: "LOW" };
};

const PRTable = () => {
  const [prs, setPRs] = useState([]);

  useEffect(() => {
    API.get("/github/prs")
      .then(r => setPRs(r.data))
      .catch(e => console.log(e));
  }, []);

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "28px"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px",
            background: "#a371f715", border: "1px solid #a371f733",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px"
          }}>📋</div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Merged Pull Requests
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              {prs.length} PR{prs.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>
      </div>

      {prs.length === 0 ? (
        <div style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "40px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔗</div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
            No PRs tracked yet. Configure the GitHub webhook and merge a PR to see data here.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["PR", "Title", "Author", "Files", "Risk", "Jira", "Merged"].map(h => (
                  <th key={h} style={{
                    textAlign: "left",
                    padding: "10px 16px 10px 0",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                    whiteSpace: "nowrap"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prs.map((pr, i) => {
                const risk = riskMeta(pr.riskScore);
                return (
                  <tr key={pr._id}
                    style={{
                      borderBottom: i < prs.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 16px 14px 0" }}>
                      <span style={{
                        fontFamily: "monospace", fontWeight: 700,
                        color: "var(--accent-blue)", fontSize: "13px"
                      }}>
                        #{pr.prId}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px 14px 0", maxWidth: "280px" }}>
                      <span style={{
                        color: "var(--text-primary)",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }} title={pr.title}>
                        {pr.title}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px 14px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          width: "26px", height: "26px", borderRadius: "50%",
                          background: "linear-gradient(135deg, #388bfd, #a371f7)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "11px", fontWeight: 700, color: "#fff", flexShrink: 0
                        }}>
                          {(pr.author || "?")[0].toUpperCase()}
                        </div>
                        <span style={{ color: "var(--text-primary)" }}>{pr.author}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px 14px 0", color: "var(--text-secondary)" }}>
                      {pr.filesChanged?.length || 0} file{pr.filesChanged?.length !== 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "14px 16px 14px 0" }}>
                      {pr.riskScore != null ? (
                        <span style={{
                          background: risk.bg,
                          border: `1px solid ${risk.border}`,
                          color: risk.color,
                          fontSize: "11px", fontWeight: 700,
                          padding: "3px 8px", borderRadius: "4px",
                          letterSpacing: "0.3px"
                        }}>
                          {pr.riskScore} · {risk.label}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px 14px 0" }}>
                      {pr.jiraTicket ? (
                        <span style={{
                          fontSize: "11px", color: "#388bfd",
                          background: "#388bfd10", border: "1px solid #388bfd22",
                          padding: "2px 8px", borderRadius: "4px",
                          fontFamily: "monospace"
                        }}>
                          {pr.jiraTicket}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 0 14px 0", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {pr.mergedAt ? new Date(pr.mergedAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric"
                      }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PRTable;
