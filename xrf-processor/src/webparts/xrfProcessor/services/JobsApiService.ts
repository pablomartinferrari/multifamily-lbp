import type { IJobsApiJob, IJobsApiResponse } from "../models/IJobsApi";

const JOBS_API_URL = "http://api.2etc.com/api/jobs";

/**
 * Service for the 2ETC Jobs API.
 * Fetches the jobs list and looks up by jobId (single-job endpoint is unavailable).
 */
export class JobsApiService {
  private cachedJobs: IJobsApiJob[] | null = null;
  private fetchPromise: Promise<IJobsApiJob[]> | null = null;

  /**
   * Fetch all jobs from the API. Results are cached for the session.
   */
  async getAllJobs(): Promise<IJobsApiJob[]> {
    if (this.cachedJobs) return this.cachedJobs;
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = (async () => {
      try {
        const res = await fetch(JOBS_API_URL, { method: "GET" });
        if (!res.ok) throw new Error(`Jobs API error: ${res.status}`);
        const data = (await res.json()) as IJobsApiResponse;
        if (!Array.isArray(data)) throw new Error("Jobs API did not return an array");
        this.cachedJobs = data;
        return this.cachedJobs;
      } catch (e) {
        this.fetchPromise = null;
        throw e;
      }
    })();

    return this.fetchPromise;
  }

  /**
   * Look up a job by jobId. Matches the user-entered Job Number to the API's jobId.
   * Uses the list endpoint since the single-job endpoint is not available.
   */
  async getJobByJobId(jobIdInput: string): Promise<IJobsApiJob | null> {
    const trimmed = jobIdInput.trim();
    if (!trimmed) return null;

    const jobs = await this.getAllJobs();
    const id = parseInt(trimmed, 10);
    if (Number.isNaN(id)) return null;

    const found = jobs.find((j) => j.jobId === id);
    return found ?? null;
  }

  /** Clear cache (e.g. for testing or refresh). */
  clearCache(): void {
    this.cachedJobs = null;
    this.fetchPromise = null;
  }
}

let jobsApiServiceInstance: JobsApiService | undefined;

export function getJobsApiService(): JobsApiService {
  if (!jobsApiServiceInstance) {
    jobsApiServiceInstance = new JobsApiService();
  }
  return jobsApiServiceInstance;
}
