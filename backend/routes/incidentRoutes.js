import express from "express";
import { analyzeIncident, analyzeIncidentWithCoral, getIncidents } from "../controllers/incidentController.js";

const router = express.Router();

router.post("/analyze", analyzeIncident); // Original MongoDB-based
router.post("/analyze-coral", analyzeIncidentWithCoral); // NEW: Coral-powered
router.get("/", getIncidents);

export default router;
