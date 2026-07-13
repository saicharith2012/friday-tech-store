import express from "express";
import { V1_PREFIX, v1Endpoints, v1Router } from "./routes/v1";

export const app = express();

app.use(express.json());

// Root: describes the API and lists every available endpoint.
app.get("/", (_req, res) => {
  res.json({
    name: "Friday API",
    description: "Customer support agentic AI system",
    version: "v1",
    endpoints: [
      { method: "GET", path: "/", description: "API info and endpoint list" },
      ...v1Endpoints,
    ],
  });
});

// All other endpoints are versioned: /api/v1/<resource>
app.use(V1_PREFIX, v1Router);
