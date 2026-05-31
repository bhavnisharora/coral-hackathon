import express from "express";
import { handleGithubWebhook, getPullRequests } from "../controllers/githubController.js";

const router = express.Router();

router.post("/webhook", handleGithubWebhook);
router.get("/prs", getPullRequests);

export default router;
