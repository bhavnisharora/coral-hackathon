import axios from "axios";
import PullRequest from "../models/PullRequest.js";
import { fetchJiraTicket } from "../services/jiraService.js";
import { generatePRSummary } from "../services/aiService.js";

const githubHeaders = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json"
};

export const handleGithubWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const event = req.headers["x-github-event"];

    console.log("[WEBHOOK] Event:", event, "| Action:", payload.action);

    if (payload.action !== "closed") {
      console.log("[WEBHOOK] Skipped — not a close event");
      return res.status(200).json({ message: "Not a close event" });
    }

    const pr = payload.pull_request;

    if (!pr || !pr.merged) {
      console.log("[WEBHOOK] Skipped — PR not merged or missing");
      return res.status(200).json({ message: "PR not merged" });
    }

    console.log(`[WEBHOOK] Processing merged PR #${pr.number}: "${pr.title}" by ${pr.user.login}`);

    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;

    // Fetch real file diffs from GitHub API
    const filesRes = await axios.get(
      `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${pr.number}/files`,
      { headers: githubHeaders }
    );

    const diffData = filesRes.data.map(f => ({
      filename: f.filename,
      patch: (f.patch || "").slice(0, 1000)
    }));

    const filesChanged = diffData.map(f => f.filename);

    // Fetch commit messages to extract Jira ticket
    const commitsRes = await axios.get(
      `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${pr.number}/commits`,
      { headers: githubHeaders }
    );
    const commitMessages = commitsRes.data.map(c => c.commit.message).join(" ");
    const searchText = `${pr.title} ${pr.body || ""} ${commitMessages}`;
    console.log("[WEBHOOK] Searching for Jira ticket in:", searchText);
    const jiraMatch = searchText.match(/[A-Z]+-\d+/);
    const jiraTicket = jiraMatch ? jiraMatch[0] : null;
    const jiraData = jiraTicket ? await fetchJiraTicket(jiraTicket) : null;
    console.log("[WEBHOOK] Jira ticket found:", jiraTicket, "| Status:", jiraData?.status || "ticket not in Jira");

    console.log("[WEBHOOK] Files fetched:", filesChanged);

    const aiResult = await generatePRSummary(pr.title, diffData);
    console.log("[WEBHOOK] AI risk score:", aiResult.riskScore);

    const newPR = await PullRequest.create({
      prId: pr.number,
      title: pr.title,
      author: pr.user.login,
      reviewers: pr.requested_reviewers.map(r => r.login),
      repoOwner,
      repoName,
      jiraTicket,
      jiraStatus: jiraData?.status,
      filesChanged,
      diffData,
      mergedAt: pr.merged_at,
      riskScore: aiResult.riskScore,
      aiSummary: aiResult.summary
    });

    console.log("[WEBHOOK] PR saved to MongoDB:", newPR._id);
    res.status(201).json(newPR);
  } catch (error) {
    console.error("[WEBHOOK ERROR]", error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
};

export const getPullRequests = async (req, res) => {
  try {
    const prs = await PullRequest.find().sort({ mergedAt: -1 }).limit(50);
    res.status(200).json(prs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
