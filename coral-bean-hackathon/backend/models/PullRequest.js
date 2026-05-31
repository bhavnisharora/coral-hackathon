import mongoose from "mongoose";

const pullRequestSchema = new mongoose.Schema({
  prId: Number,
  title: String,
  author: String,
  reviewers: [String],
  repoOwner: String,
  repoName: String,
  jiraTicket: String,
  jiraStatus: String,
  filesChanged: [String],
  diffData: [{ filename: String, patch: String }],
  mergedAt: Date,
  riskScore: Number,
  aiSummary: String
}, {
  timestamps: true
});

export default mongoose.model("PullRequest", pullRequestSchema);