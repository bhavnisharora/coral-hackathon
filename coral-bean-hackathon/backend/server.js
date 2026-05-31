import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

import githubRoutes from "./routes/githubRoutes.js";
import incidentRoutes from "./routes/incidentRoutes.js";
// import seedRoutes from "./routes/seedRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/github", githubRoutes);
app.use("/api/incidents", incidentRoutes);
// app.use("/api/seed", seedRoutes);

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("MongoDB Connected");

  app.listen(5000, () => {
    console.log("Server Running on Port 5000");
  });
})
.catch((err) => {
  console.log(err);
});