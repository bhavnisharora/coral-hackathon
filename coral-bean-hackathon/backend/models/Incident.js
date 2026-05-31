import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema({
  bugDescription: String,
  daysBack: Number,
  source: { type: String, default: "mongodb" }, // "mongodb" or "coral"
  suspectedPRs: [
    {
      prId: Number,
      author: String,
      files: [String],
      reason: String,
      confidence: Number,
      jiraTicket: String,
      jiraStatus: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Incident", incidentSchema);
