import Incident from "../models/Incident.js";
import PullRequest from "../models/PullRequest.js";
import { analyzeBugAcrossPRs } from "../services/aiService.js";
import { sendSlackAlert } from "../services/slackService.js";
import { searchRelevantPRs, fetchPRDiffs } from "../services/coralService.js";

// Coral-powered analysis — falls back to MongoDB if Coral not available
export const analyzeIncidentWithCoral = async (req, res) => {
  try {
    const { bugDescription, daysBack = 7, repoOwner, repoName } = req.body;

    if (!bugDescription) {
      return res.status(400).json({ error: "bugDescription is required" });
    }

    // If CORAL_PATH not set or we're on a server without Coral, use MongoDB mode
    const coralAvailable = !!process.env.CORAL_PATH;

    if (!coralAvailable) {
      console.log("[CORAL] CORAL_PATH not set — falling back to MongoDB mode");
      const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const prs = await PullRequest.find({ mergedAt: { $gte: cutoff } });

      if (prs.length === 0) {
        return res.status(404).json({ error: `No PRs found in the last ${daysBack} days` });
      }

      const aiResult = await analyzeBugAcrossPRs(bugDescription, prs);
      const incident = await Incident.create({
        bugDescription, daysBack,
        suspectedPRs: aiResult.suspectedPRs,
        source: "mongodb"
      });

      if (aiResult.suspectedPRs.length > 0) {
        const top = aiResult.suspectedPRs[0];
        const slackMsg = `🪸 *Coral Agent Bug Triage*\n*Bug:* ${bugDescription}\n\n*Top Suspect:* PR #${top.prId} by ${top.author} (${top.confidence}% confidence)\n*Files:* ${top.files.join(", ")}\n*Jira:* ${top.jiraTicket || "N/A"}\n*Reason:* ${top.reason}`;
        await sendSlackAlert(slackMsg).catch(e => console.log("Slack error:", e.message));
      }

      return res.status(201).json(incident);
    }

    // Coral is available — use real-time GitHub data
    const owner = repoOwner || process.env.GITHUB_REPO_OWNER;
    const repo = repoName || process.env.GITHUB_REPO_NAME;

    console.log(`[CORAL] Searching for PRs related to: "${bugDescription}"`);

    // Step 1: Use Coral to find semantically relevant PRs
    const relevantPRs = await searchRelevantPRs(owner, repo, bugDescription, daysBack);

    console.log(`[CORAL] Found ${relevantPRs.length} relevant PRs`);

    if (relevantPRs.length === 0) {
      return res.status(404).json({ error: `No PRs found in the last ${daysBack} days` });
    }

    // Step 2: Fetch detailed diffs for each relevant PR
    // Use Coral diffs if available, otherwise fall back to MongoDB
    const prsWithDiffs = await Promise.all(
      relevantPRs.slice(0, 5).map(async (pr) => {
        // Coral returns 'number' field, map it to prId
        const prId = pr.prId || pr.number;

        let diffs = [];
        try {
          diffs = await fetchPRDiffs(owner, repo, prId);
        } catch (e) {
          console.log(`[CORAL] fetchPRDiffs failed for PR #${prId}:`, e.message);
        }

        // Fall back to MongoDB if Coral diffs are empty
        if (!diffs || diffs.length === 0) {
          const mongoPR = await PullRequest.findOne({ prId: Number(prId) });
          if (mongoPR) {
            console.log(`[CORAL] Using MongoDB diffs for PR #${prId}`);
            diffs = mongoPR.diffData || [];
          }
        }

        return {
          prId,
          title: pr.title,
          author: pr.author || pr.user__login,
          mergedAt: pr.mergedAt || pr.merged_at,
          filesChanged: diffs.map(d => d.filename),
          diffData: diffs.map(d => ({
            filename: d.filename,
            patch: (d.patch || "").slice(0, 1000)
          })),
          jiraTicket: pr.jiraTicket,
          jiraStatus: pr.jiraStatus
        };
      })
    );

    console.log(`[CORAL] Fetched diffs for ${prsWithDiffs.length} PRs`);
    console.log("[CORAL] PRs being sent to AI:", JSON.stringify(prsWithDiffs.map(p => ({
      prId: p.prId, title: p.title, author: p.author,
      filesChanged: p.filesChanged, hasDiffs: p.diffData.length > 0
    })), null, 2));

    // Step 3: Send enriched context to AI
    const aiResult = await analyzeBugAcrossPRs(bugDescription, prsWithDiffs);

    // Step 4: Save incident
    const incident = await Incident.create({
      bugDescription,
      daysBack,
      suspectedPRs: aiResult.suspectedPRs,
      source: "coral" // Mark as Coral-powered
    });

    // Step 5: Send Slack alert
    if (aiResult.suspectedPRs.length > 0) {
      const top = aiResult.suspectedPRs[0];
      const slackMsg = `🪸 *Coral-Powered Bug Triage Alert*\n*Bug:* ${bugDescription}\n\n*Top Suspect:* PR #${top.prId} by ${top.author} (${top.confidence}% confidence)\n*Files:* ${top.files.join(", ")}\n*Jira:* ${top.jiraTicket || "N/A"}\n*Reason:* ${top.reason}`;
      await sendSlackAlert(slackMsg).catch(e => console.log("Slack error:", e.message));
    }

    res.status(201).json(incident);
  } catch (error) {
    console.error("[CORAL] Analysis failed:", error);
    res.status(500).json({ error: error.message });
  }
};

// KEEP: Original MongoDB-based analysis (fallback)
export const analyzeIncident = async (req, res) => {
  try {
    const { bugDescription, daysBack = 7 } = req.body;

    if (!bugDescription) {
      return res.status(400).json({ error: "bugDescription is required" });
    }

    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const prs = await PullRequest.find({ mergedAt: { $gte: cutoff } });

    if (prs.length === 0) {
      return res.status(404).json({ error: `No PRs found in the last ${daysBack} days` });
    }

    const aiResult = await analyzeBugAcrossPRs(bugDescription, prs);

    const incident = await Incident.create({
      bugDescription,
      daysBack,
      suspectedPRs: aiResult.suspectedPRs
    });

    if (aiResult.suspectedPRs.length > 0) {
      const top = aiResult.suspectedPRs[0];
      const slackMsg = `🚨 *Bug Triage Alert*\n*Bug:* ${bugDescription}\n\n*Top Suspect:* PR #${top.prId} by ${top.author} (${top.confidence}% confidence)\n*Files:* ${top.files.join(", ")}\n*Reason:* ${top.reason}`;
      await sendSlackAlert(slackMsg).catch(e => console.log("Slack error:", e.message));
    }

    res.status(201).json(incident);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 }).limit(20);
    res.status(200).json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
