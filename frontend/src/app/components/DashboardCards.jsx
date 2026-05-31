"use client";

import { useEffect, useState } from "react";
import API from "../services/api";

const cards = (stats) => [
  {
    title: "Total PRs Tracked",
    value: stats.totalPRs,
    icon: "⬡",
    gradient: "linear-gradient(135deg, #1c2333 0%, #1a2744 100%)",
    accent: "#388bfd",
    glow: "#388bfd22",
    border: "#388bfd33"
  },
  // {
  //   title: "Bug Analyses Run",
  //   value: stats.incidents,
  //   icon: "◈",
  //   gradient: "linear-gradient(135deg, #1c2333 0%, #1e1a2e 100%)",
  //   accent: "#a371f7",
  //   glow: "#a371f722",
  //   border: "#a371f733"
  // },
  {
    title: "High Risk PRs",
    value: stats.highRiskPRs,
    icon: "⚠",
    gradient: "linear-gradient(135deg, #1c2333 0%, #2a1a1a 100%)",
    accent: "#f85149",
    glow: "#f8514922",
    border: "#f8514933"
  },
  {
    title: "Avg Risk Score",
    value: stats.avgRisk || "0.0",
    icon: "◎",
    gradient: "linear-gradient(135deg, #1c2333 0%, #2a2210 100%)",
    accent: "#d29922",
    glow: "#d2992222",
    border: "#d2992233"
  }
];

const DashboardCards = () => {
  const [stats, setStats] = useState({ totalPRs: 0, incidents: 0, highRiskPRs: 0, avgRisk: "0.0" });

  useEffect(() => {
    const load = async () => {
      try {
        const [prsRes, incidentsRes] = await Promise.all([
          API.get("/github/prs"),
          API.get("/incidents")
        ]);
        const prs = prsRes.data;
        setStats({
          totalPRs: prs.length,
          incidents: incidentsRes.data.length,
          highRiskPRs: prs.filter(p => p.riskScore >= 7).length,
          avgRisk: prs.length
            ? (prs.reduce((s, p) => s + (p.riskScore || 0), 0) / prs.length).toFixed(1)
            : "0.0"
        });
      } catch (e) {
        console.log(e);
      }
    };
    load();
  }, []);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "16px",
      marginBottom: "28px"
    }}>
      {cards(stats).map((card, i) => (
        <div key={i} style={{
          background: card.gradient,
          border: `1px solid ${card.border}`,
          borderRadius: "12px",
          padding: "24px",
          position: "relative",
          overflow: "hidden",
          transition: "transform 0.2s, box-shadow 0.2s",
          cursor: "default"
        }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 8px 24px ${card.glow}`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{
            position: "absolute", top: "-20px", right: "-10px",
            fontSize: "80px", opacity: 0.04, color: card.accent,
            fontWeight: 900, lineHeight: 1, userSelect: "none"
          }}>{card.icon}</div>

          <div style={{
            fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)",
            textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px"
          }}>
            {card.title}
          </div>

          <div style={{
            fontSize: "40px", fontWeight: 700, color: card.accent,
            lineHeight: 1, letterSpacing: "-1px"
          }}>
            {card.value}
          </div>

          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "2px",
            background: `linear-gradient(90deg, ${card.accent}88, transparent)`
          }} />
        </div>
      ))}
    </div>
  );
};

export default DashboardCards;
