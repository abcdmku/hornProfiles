import { createApp, toNodeListener, eventHandler, readBody } from "h3";
import { createServer } from "node:http";
import type { SimulationRequest, JobStatus } from "@horn-sim/types";
import { generateJobId } from "@horn-sim/utils/hash";
import { simulationQueue } from "./lib/queue";
import { createSimulationRoutes } from "./routes/simulation";

const app = createApp();

// Add simulation routes
const routes = createSimulationRoutes();
app.use("/api/simulate", routes);

// Health check
app.use(
  "/api/health",
  eventHandler(() => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  })),
);

// Start server
const port = process.env.PORT || 3000;
createServer(toNodeListener(app)).listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
