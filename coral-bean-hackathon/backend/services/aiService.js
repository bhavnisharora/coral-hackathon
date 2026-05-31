import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const extractJSON = (text) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

export const generatePRSummary = async (title, files = []) => {
  try {
    const fileList = files
      .map((f) => `${f.filename}:\n${(f.patch || "").slice(0, 500)}`)
      .join("\n\n");

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: `Analyze this pull request and return a risk score (1-10) and short summary.\n\nTitle: ${title}\n\nFiles changed:\n${fileList || "No diff available"}\n\nRespond ONLY with valid JSON:\n{"riskScore": 7, "summary": "explanation here"}`
        }
      ]
    });

    const text = response.choices[0].message.content;
    const parsed = extractJSON(text);
    return parsed || { riskScore: 5, summary: text };
  } catch (err) {
    console.error("[AI] generatePRSummary error:", err.message);
    return { riskScore: 5, summary: "AI analysis failed" };
  }
};

export const analyzeBugAcrossPRs = async (bugDescription, prs) => {
  try {
    const sorted = prs
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 15);

    const prContext = sorted
      .map((pr) => {
        const diffs = (pr.diffData || [])
          .map((f) => `${f.filename}:\n${(f.patch || "").slice(0, 800)}`)
          .join("\n\n");
        const jiraInfo = pr.jiraTicket ? `\nJira: ${pr.jiraTicket} (${pr.jiraStatus || "Unknown"})` : "";
        return `PR #${pr.prId}\nAuthor: ${pr.author}\nFiles: ${(pr.filesChanged || []).join(", ")}${jiraInfo}\nDiff:\n${diffs || "No diff"}`;
      })
      .join("\n\n---\n\n");

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a bug triage assistant. You MUST respond with ONLY a raw JSON object. No markdown, no code blocks, no explanation, no text before or after the JSON."
        },
        {
          role: "user",
          content: `Bug reported: "${bugDescription}"\n\nPull requests merged recently:\n\n${prContext}\n\nWhich PR(s) most likely introduced this bug?\n\nIMPORTANT: Use ONLY the jiraTicket values shown in the PR context above. Do not invent or guess Jira ticket IDs.\n\nRespond with ONLY this JSON, nothing else:\n{"suspectedPRs":[{"prId":3,"author":"dev_name","files":["src/file.js"],"reason":"explanation","confidence":85,"jiraTicket":null,"jiraStatus":null}]}`
        }
      ]
    });

    const raw = response.choices[0].message.content;
    console.log("[AI RAW RESPONSE]:", raw);

    const parsed = extractJSON(raw);
    if (!parsed) {
      console.error("[AI] Could not extract JSON from response");
      return { suspectedPRs: [] };
    }

    return parsed;
  } catch (err) {
    console.error("[AI] analyzeBugAcrossPRs error:", err.message);
    return { suspectedPRs: [] };
  }
};
