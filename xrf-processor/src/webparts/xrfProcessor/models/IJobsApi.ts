/**
 * Types for the 2ETC Jobs API (http://api.2etc.com/api/jobs)
 * Used to link the Job Number entered in the app to job records.
 */
/* eslint-disable @rushstack/no-new-null -- API response uses null for optional fields */

export interface IJobsApiClient {
  id: number;
  name: string;
}

export interface IJobsApiStatus {
  id: number;
  status: string | null;
}

export interface IJobsApiJob {
  jobId: number;
  client: IJobsApiClient;
  facilityName: string | null;
  facilityAddress: string | null;
  status: IJobsApiStatus;
}

export type IJobsApiResponse = IJobsApiJob[];
