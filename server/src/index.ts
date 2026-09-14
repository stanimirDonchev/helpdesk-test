import cors from "cors";
import express from "express";
import type { HealthResponse } from "shared/api-types";

const app = express();
const port = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  const body: HealthResponse = { status: "ok" };
  res.json(body);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
