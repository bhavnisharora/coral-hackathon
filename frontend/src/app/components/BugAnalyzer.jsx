"use client";

import { useState } from "react";
import API from "../services/api";

const confidenceMeta = (c) => {
  if (c >= 75) return { color: "#f85149", bg: "#f8514915", border: "#f8514933", label: "HIGH" };
  if (c >= 50) return { color: "#d29922", bg: "#d2992215", border: "#d2992233", label: "MED" };
  return { color: "#3fb950", bg: "#3fb95015", border: "#3fb95033", label: "LOW" };
};

const BugAnalyzer = () => {
  const [bugDescription, setBugDescription] = useState("");
  const [daysBack, setDaysBack] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [useCoral, setUseCoral] = useState(true); // NEW: Toggle for Coral

  const analyze = async () => {
    if (!bugDescription.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const endpoint = useCoral ? "/incidents/analyze-coral" : "/incidents/analyze";
      const res = await API.post(endpoint, { bugDescription, daysBack });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || "Analysis failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "28px",
      marginBottom: "24px"
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px",
          background: "#388bfd15", border: "1px solid #388bfd33",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px"
        }}>🔍</div>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Bug Triage
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
            Describe the bug — AI will scan recent PRs and find the culprit
          </p>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        rows={4}
        placeholder='e.g. "Payment is failing at checkout for users with promo codes. Getting a 500 error."'
        value={bugDescription}
        onChange={e => setBugDescription(e.target.value)}
        style={{
          width: "100%",
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "14px 16px",
          fontSize: "14px",
          color: "var(--text-primary)",
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          lineHeight: 1.6,
          transition: "border-color 0.2s"
        }}
        onFocus={e => e.target.style.borderColor = "#388bfd"}
        onBlur={e => e.target.style.borderColor = "var(--border)"}
      />

      {/* Slider row */}
      <div style={{
        display: "flex", alignItems: "center", gap: "16px",
        marginTop: "16px",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "12px 16px"
      }}>
        <span style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          Look back
        </span>
        <input
          type="range" min={1} max={30} value={daysBack}
          onChange={e => setDaysBack(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#388bfd", cursor: "pointer" }}
        />
        <span style={{
          fontSize: "13px", fontWeight: 700, color: "var(--accent-blue)",
          background: "#388bfd15", border: "1px solid #388bfd33",
          padding: "2px 10px", borderRadius: "20px", whiteSpace: "nowrap"
        }}>
          {daysBack}d
        </span>
      </div>

      {/* NEW: Coral Toggle */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        marginTop: "12px",
        padding: "12px 16px",
        background: useCoral ? "#a371f715" : "var(--bg-primary)",
        border: `1px solid ${useCoral ? "#a371f733" : "var(--border)"}`,
        borderRadius: "8px",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
        onClick={() => setUseCoral(!useCoral)}
      >
        <div style={{
          width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
          background: useCoral ? "linear-gradient(135deg, #a371f7, #388bfd)" : "var(--bg-card)",
          border: `1px solid ${useCoral ? "#a371f7" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s", boxShadow: useCoral ? "0 0 8px #a371f755" : "none"
        }}>
          {useCoral && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={useCoral ? "#a371f7" : "var(--text-secondary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.2s" }}>
              <path d="M12 22V12" />
              <path d="M12 12C12 8 8 6 8 3" />
              <path d="M12 12C12 8 16 6 16 3" />
              <path d="M8 12C8 9 5 8 5 5" />
              <path d="M16 12C16 9 19 8 19 5" />
            </svg>
            Use Coral Query Engine
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Semantic search across GitHub + Jira + Slack (real-time data)
          </div>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={analyze}
        disabled={loading || !bugDescription.trim()}
        style={{
          marginTop: "16px",
          background: loading || !bugDescription.trim()
            ? "var(--bg-card)"
            : "linear-gradient(135deg, #388bfd, #1f6feb)",
          color: loading || !bugDescription.trim() ? "var(--text-secondary)" : "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "12px 28px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: loading || !bugDescription.trim() ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          transition: "opacity 0.2s, transform 0.1s",
          boxShadow: loading || !bugDescription.trim() ? "none" : "0 4px 14px #388bfd33"
        }}
        onMouseEnter={e => { if (!loading && bugDescription.trim()) e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
      >
        {loading ? (
          <>
            <div style={{
              width: "14px", height: "14px",
              border: "2px solid #ffffff44",
              borderTop: "2px solid #fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }} />
            Analyzing PRs...
          </>
        ) : (
          <> ⚡ Analyze PRs </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Loading state */}
      {loading && (
        <div style={{
          marginTop: "20px",
          background: "var(--bg-primary)",
          border: "1px solid #388bfd33",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "var(--accent-blue)",
            boxShadow: "0 0 8px var(--accent-blue)",
            animation: "pulse 1s ease-in-out infinite"
          }} />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Fetching PRs from MongoDB and running Groq AI analysis...
          </span>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: "20px",
          background: "#f8514910",
          border: "1px solid #f8514933",
          borderRadius: "8px",
          padding: "14px 16px",
          fontSize: "13px",
          color: "#f85149"
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: "24px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px"
          }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Analysis complete —
            </span>
            <span style={{
              fontSize: "13px", fontWeight: 700,
              color: result.suspectedPRs?.length > 0 ? "#f85149" : "#3fb950"
            }}>
              {result.suspectedPRs?.length || 0} suspect(s) found
            </span>
          </div>

          {result.suspectedPRs?.length === 0 ? (
            <div style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "20px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "14px"
            }}>
              ✅ No suspicious PRs found in this time range.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {result.suspectedPRs.map((pr, i) => {
                const meta = confidenceMeta(pr.confidence);
                return (
                  <div key={i} style={{
                    background: "var(--bg-primary)",
                    border: `1px solid ${i === 0 ? meta.border : "var(--border)"}`,
                    borderRadius: "10px",
                    padding: "20px",
                    position: "relative",
                    overflow: "hidden"
                  }}>
                    {i === 0 && (
                      <div style={{
                        position: "absolute", top: 0, left: 0, right: 0,
                        height: "2px",
                        background: `linear-gradient(90deg, ${meta.color}, transparent)`
                      }} />
                    )}

                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                      <div>
                        {i === 0 && (
                          <span style={{
                            fontSize: "10px", fontWeight: 700, color: meta.color,
                            background: meta.bg, border: `1px solid ${meta.border}`,
                            padding: "2px 8px", borderRadius: "4px",
                            marginRight: "8px", letterSpacing: "0.5px"
                          }}>TOP SUSPECT</span>
                        )}
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                          PR #{pr.prId}
                        </span>
                        <span style={{ fontSize: "13px", color: "var(--text-secondary)", marginLeft: "8px" }}>
                          by {pr.author}
                        </span>
                      </div>

                      <div style={{
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                        borderRadius: "20px",
                        padding: "4px 12px",
                        display: "flex", alignItems: "center", gap: "6px",
                        flexShrink: 0
                      }}>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: meta.color }}>
                          {pr.confidence}%
                        </span>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: meta.color, letterSpacing: "0.5px" }}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {pr.files?.length > 0 && (
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px"
                      }}>
                        {pr.files.map((f, fi) => (
                          <span key={fi} style={{
                            fontSize: "11px", color: "var(--accent-blue)",
                            background: "#388bfd10", border: "1px solid #388bfd22",
                            padding: "2px 8px", borderRadius: "4px",
                            fontFamily: "monospace"
                          }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    <p style={{
                      fontSize: "13px", color: "var(--text-secondary)",
                      lineHeight: 1.6, margin: 0
                    }}>
                      {pr.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BugAnalyzer;
