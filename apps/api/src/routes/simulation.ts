import { createRouter, eventHandler, readBody } from "h3";
import { z } from "zod";
import { SimulationRequest } from "../../../../libs/horn-sim/types/src/lib/types";
import { simulationQueue } from "../lib/queue";

const SimulationRequestSchema = z.object({
  geometry: z.object({
    mode: z.enum(["circle", "ellipse", "superellipse", "rectangular", "stereographic"]),
    profile: z.array(z.object({ x: z.number(), y: z.number() })),
    width: z.number().optional(),
    height: z.number().optional(),
    throatRadius: z.number(),
  }),
  params: z.object({
    frequencies: z.array(z.number()),
    driverPistonRadius: z.number(),
    medium: z.object({
      rho: z.number(),
      c: z.number(),
    }),
    mesh: z.object({
      elementSize: z.number(),
      curvatureRefine: z.boolean().optional(),
    }),
    directivity: z.object({
      anglesDeg: z.array(z.number()),
    }),
  }),
});

export function createSimulationRoutes() {
  const router = createRouter();

  // POST /api/simulate - Enqueue simulation
  router.post(
    "/",
    eventHandler(async (event) => {
      try {
        const body = await readBody(event);
        const request = SimulationRequestSchema.parse(body) as SimulationRequest;
        const jobId = await simulationQueue.enqueue(request);
        return { jobId };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid request",
            data: error.errors,
          });
        }
        throw error;
      }
    }),
  );

  // GET /api/simulate/:jobId - Get job status
  router.get(
    "/:jobId",
    eventHandler(async (event) => {
      const jobId = event.context.params?.jobId;
      if (!jobId) {
        throw createError({
          statusCode: 400,
          statusMessage: "Job ID required",
        });
      }

      const status = await simulationQueue.getStatus(jobId);
      if (!status) {
        throw createError({
          statusCode: 404,
          statusMessage: "Job not found",
        });
      }

      return status;
    }),
  );

  // POST /api/simulate/blocking - Run simulation synchronously
  router.post(
    "/blocking",
    eventHandler(async (event) => {
      try {
        const body = await readBody(event);
        const request = SimulationRequestSchema.parse(body) as SimulationRequest;
        const jobId = await simulationQueue.enqueue(request);

        // Wait for completion
        let status = await simulationQueue.getStatus(jobId);
        while ((status && status.status === "queued") || status?.status === "running") {
          await new Promise((resolve) => setTimeout(resolve, 100));
          status = await simulationQueue.getStatus(jobId);
        }

        if (status?.status === "done" && status.result) {
          return status.result;
        } else if (status?.status === "error") {
          throw createError({
            statusCode: 500,
            statusMessage: status.error || "Simulation failed",
          });
        }

        throw createError({
          statusCode: 500,
          statusMessage: "Simulation failed",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid request",
            data: error.errors,
          });
        }
        throw error;
      }
    }),
  );

  // DELETE /api/simulate/:jobId - Cancel job
  router.delete(
    "/:jobId",
    eventHandler(async (event) => {
      const jobId = event.context.params?.jobId;
      if (!jobId) {
        throw createError({
          statusCode: 400,
          statusMessage: "Job ID required",
        });
      }

      const cancelled = simulationQueue.cancelJob(jobId);
      if (!cancelled) {
        throw createError({
          statusCode: 400,
          statusMessage: "Job cannot be cancelled",
        });
      }

      return { message: "Job cancelled" };
    }),
  );

  // GET /api/simulate/:jobId/events - SSE for progress
  router.get(
    "/:jobId/events",
    eventHandler(async (event) => {
      const jobId = event.context.params?.jobId;
      if (!jobId) {
        throw createError({
          statusCode: 400,
          statusMessage: "Job ID required",
        });
      }

      event.node.res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Send periodic updates
      const interval = setInterval(async () => {
        const status = await simulationQueue.getStatus(jobId);
        if (status) {
          event.node.res.write(
            `data: ${JSON.stringify({
              type: status.status,
              data: status,
              timestamp: Date.now(),
            })}\n\n`,
          );

          if (status.status === "done" || status.status === "error") {
            clearInterval(interval);
            event.node.res.end();
          }
        }
      }, 500);

      // Clean up on disconnect
      event.node.req.on("close", () => {
        clearInterval(interval);
      });
    }),
  );

  return router;
}

interface HttpError extends Error {
  statusCode: number;
  data?: unknown;
}

function createError(options: {
  statusCode: number;
  statusMessage: string;
  data?: unknown;
}): HttpError {
  const error = new Error(options.statusMessage) as HttpError;
  error.statusCode = options.statusCode;
  error.data = options.data;
  return error;
}
