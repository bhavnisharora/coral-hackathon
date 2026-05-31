import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

// Try to find Coral executable
const getCoralCommand = () => {
  // Check if CORAL_PATH is set in env
  if (process.env.CORAL_PATH) {
    return process.env.CORAL_PATH;
  }

  // Check if we should use WSL
  if (process.env.USE_WSL_CORAL === "true") {
    return "wsl coral";
  }

  // Common Windows installation paths
  const possiblePaths = [
    "coral", // If in PATH
    path.join(os.homedir(), ".coral", "bin", "coral.exe"),
    path.join(os.homedir(), ".coral", "bin", "coral"),
    "C:\\Program Files\\coral\\coral.exe",
  ];

  // For now, return the first one and let user set CORAL_PATH if needed
  return possiblePaths[0];
};

const CORAL_CMD = getCoralCommand();

/**
 * Execute a Coral SQL query and return JSON results
 */
export const runCoralQuery = async (query) => {
  let tempBat = null;
  try {
    // Collapse query to single line and escape double quotes
    const singleLineQuery = query
      .replace(/\r?\n/g, ' ')  // remove newlines
      .replace(/\s+/g, ' ')    // collapse whitespace
      .trim()
      .replace(/"/g, '""');    // escape double quotes for cmd

    tempBat = path.join(os.tmpdir(), `coral-${Date.now()}.bat`);
    const batchContent = `@echo off\n"${CORAL_CMD}" sql "${singleLineQuery}" --format json`;

    await fs.writeFile(tempBat, batchContent, 'utf8');

    console.log("[CORAL] Query:", singleLineQuery.substring(0, 100) + "...");

    const { stdout, stderr } = await execAsync(`"${tempBat}"`, {
      maxBuffer: 1024 * 1024 * 10,
      shell: 'cmd.exe',
      encoding: 'utf8'
    });

    if (stderr && !stderr.includes('Connecting')) {
      console.error("[CORAL ERROR]", stderr);
    }

    const output = stdout.trim();
    if (!output) return [];

    return JSON.parse(output);
  } catch (error) {
    console.error("[CORAL] Query failed:", error.message);
    throw new Error(`Coral query failed: ${error.message}`);
  } finally {
    if (tempBat) {
      try { await fs.unlink(tempBat); } catch (e) {}
    }
  }
};

/**
 * Fetch PRs merged in the last N days with enriched context
 * Joins GitHub PRs + Jira tickets + file changes
 */
export const fetchEnrichedPRs = async (repoOwner, repoName, daysBack = 7) => {
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const query = `
    SELECT
      pr.number as prId,
      pr.title,
      pr.author,
      pr.merged_at as mergedAt,
      pr.files_changed as filesChanged,
      pr.additions,
      pr.deletions,
      jira.key as jiraTicket,
      jira.status as jiraStatus,
      jira.priority as jiraPriority
    FROM github.pull_requests pr
    LEFT JOIN jira.issues jira
      ON pr.title LIKE '%' || jira.key || '%'
    WHERE pr.repo = '${repoOwner}/${repoName}'
      AND pr.state = 'closed'
      AND pr.merged_at >= '${cutoffDate}'
    ORDER BY pr.merged_at DESC
    LIMIT 20
  `;

  return await runCoralQuery(query);
};

/**
 * Fetch detailed file diffs for a specific PR
 * Falls back gracefully if table not found
 */
export const fetchPRDiffs = async (repoOwner, repoName, prNumber) => {
  // Try different possible table names for PR files
  const tableNames = [
    'github.pull_request_files',
    'github.pulls_files',
    'github.pr_files',
    'github.pull_files'
  ];

  for (const table of tableNames) {
    try {
      const query = `SELECT filename, patch, additions, deletions, status FROM ${table} WHERE owner = '${repoOwner}' AND repo = '${repoName}' AND pull_number = ${prNumber}`;
      const result = await runCoralQuery(query);
      return result;
    } catch (e) {
      if (!e.message.includes('not found')) throw e;
      // Try next table name
    }
  }

  // If no table works, return empty — controller will use MongoDB diffs
  console.log(`[CORAL] No PR files table found, will use MongoDB diffs for PR #${prNumber}`);
  return [];
};

/**
 * Search for PRs semantically related to a bug description
 * Uses Coral's built-in semantic search if available
 */
export const searchRelevantPRs = async (repoOwner, repoName, bugDescription, daysBack = 7) => {
  // Get recent merged PRs — filter by date in JS to avoid Coral date format issues
  const query = `SELECT number as prId, title, user__login as author, merged_at as mergedAt, changed_files as filesChanged FROM github.pulls WHERE owner = '${repoOwner}' AND repo = '${repoName}' AND state = 'closed' AND merged_at IS NOT NULL ORDER BY merged_at DESC LIMIT 20`;

  const results = await runCoralQuery(query);
  console.log("[CORAL] Raw result sample:", JSON.stringify(results[0]));

  // Coral lowercases all aliases: prId→prid, mergedAt→mergedat, filesChanged→fileschanged
  const normalized = results.map(pr => {
    const prId = Number(pr.prid ?? pr.number ?? pr.prId ?? 0);
    return {
      prId,
      title: pr.title,
      author: pr.author ?? pr.user__login ?? "unknown",
      mergedAt: pr.mergedat ?? pr.merged_at ?? pr.mergedAt,
      filesChanged: pr.fileschanged ?? pr.changed_files ?? [],
      jiraTicket: pr.jiraticket ?? pr.jiraTicket ?? null,
      jiraStatus: pr.jirastatus ?? pr.jiraStatus ?? null
    };
  }).filter(pr => pr.prId > 0);

  console.log("[CORAL] Normalized PRs:", normalized.map(p => ({ prId: p.prId, title: p.title, mergedAt: p.mergedAt })));

  // Filter by daysBack in JavaScript
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const filtered = normalized.filter(pr => pr.mergedAt && new Date(pr.mergedAt) >= cutoff);

  console.log(`[CORAL] After date filter (${daysBack}d): ${filtered.length}`);

  // If nothing passes the date filter, return all anyway
  return filtered.length > 0 ? filtered : normalized.slice(0, 10);
};

/**
 * Get Slack discussions related to a PR author (if Slack is configured)
 */
export const fetchSlackContext = async (author, daysBack = 7) => {
  try {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const query = `
      SELECT
        message,
        user,
        timestamp,
        channel
      FROM slack.messages
      WHERE user = '${author}'
        AND timestamp >= '${cutoffDate}'
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    return await runCoralQuery(query);
  } catch (error) {
    console.log("[CORAL] Slack not configured or query failed:", error.message);
    return [];
  }
};
