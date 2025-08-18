import type { SimulationRequest, JobStatus, SimulationResult } from "@horn-sim/types";
import { generateJobId } from "@horn-sim/utils/hash";

interface QueueJob {
  id: string;
  request: SimulationRequest;
  status: JobStatus["status"];
  result?: SimulationResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class SimulationQueue {
  private jobs = new Map<string, QueueJob>();
  private queue: string[] = [];
  private processing = false;
  private maxConcurrency = 1;

  async enqueue(request: SimulationRequest): Promise<string> {
    const jobId = generateJobId();
    const job: QueueJob = {
      id: jobId,
      request,
      status: "queued",
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  async getStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
    };
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift();
      if (!jobId) continue;

      const job = this.jobs.get(jobId);
      if (!job) continue;

      job.status = "running";
      job.startedAt = new Date();

      try {
        // Mock simulation for now
        const result = await this.runSimulation(job.request);
        job.result = result;
        job.status = "done";
      } catch (error) {
        job.error = error instanceof Error ? error.message : "Unknown error";
        job.status = "error";
      } finally {
        job.completedAt = new Date();
      }
    }

    this.processing = false;
  }

  private async runSimulation(request: SimulationRequest): Promise<SimulationResult> {
    // Mock implementation - will be replaced with actual Elmer runner
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      requestHash: "mock-hash",
      frequencies: request.params.frequencies,
      onAxisSPL: request.params.frequencies.map(() => Math.random() * 100),
      polar: request.params.directivity.anglesDeg.reduce(
        (acc, angle) => ({
          ...acc,
          [angle]: request.params.frequencies.map(() => Math.random() * 100),
        }),
        {},
      ),
      meta: {
        meshElements: 1000,
        runtimeMs: 1000,
        version: "1.0.0",
      },
    };
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "queued") return false;

    const queueIndex = this.queue.indexOf(jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    job.status = "error";
    job.error = "Cancelled by user";
    return true;
  }

  getAllJobs(): QueueJob[] {
    return Array.from(this.jobs.values());
  }
}

export const simulationQueue = new SimulationQueue();
