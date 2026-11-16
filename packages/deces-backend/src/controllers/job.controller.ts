import express from 'express';
import { Queue, JobType } from 'bullmq';
import { Controller, Get, Route, Tags, Path, Query, Request, Security } from 'tsoa';
import { buildRedisConnectionOptions } from '../redisClient';

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Verifier le status de jobs
 */
@Route('queue')
export class JobsController extends Controller {

  /**
   * Number of jobs
   * @summary Vérifier le nombre de jobs
   * @param name Name of queue
   */
  @Tags('Jobs')
  @Get('')
  public async jobName(
    @Query() name?: 'jobs'|'chunks',
  ): Promise<any> {
    if (name !== undefined) {
      const jobQueue = new Queue(name,  {
        connection: buildRedisConnectionOptions()
      });
      return await jobQueue.getJobCounts();
    } else {
      return {msg: 'available queues: "chunks" and "jobs". Use them as a query parameter. For example name=jobs'};
    }
  }

  /**
   * Jobs details
   * @summary Détails du jobs par type et par id
   * @param queueName Name of queue
   * @param jobsType Jobs type or Id
   */
  @Security("jwt", ["user"])
  @Tags('Jobs')
  @Get('{queueName}')
  public async getJobs(
    @Request() request: express.Request,
    @Path() queueName: 'jobs',
    @Query() jobId?: string,
    @Query() jobsType?: JobType,
  ): Promise<any> {
    const scopes = (request as any).user && (request as any).user.scopes
    const user = (request as any).user && (request as any).user.user
    const isAdmin = !!(scopes && scopes.includes('admin'));
    const isOwner = (j: any): boolean => Boolean(user) && !!(j && j.data && j.data.user) && j.data.user === user;
    // The job key (randomKey) is the only download/cancel credential and is
    // only ever returned to the job owner — including an admin viewing their
    // own jobs (admin self-service). Admins keep seeing the other job
    // metadata (owner, status) they need for support, but never another
    // owner's key, so an admin cannot cancel other users' jobs: cancellation
    // requires the key only its owner holds. Non-admin non-owners get exactly
    // `{msg: 'job not found'}`, the same response as an unknown job id.
    const stripKeyUnlessOwner = (j: any): void => {
      if (j && j.data && !isOwner(j)) {
        j.data.randomKey = undefined;
      }
    };
    const jobQueue = new Queue(queueName,  {
      connection: buildRedisConnectionOptions()
    });
    const jobsTypeList: JobType[] = ['completed', 'failed', 'active', 'delayed', 'waiting', 'waiting-children', 'paused', 'repeat', 'wait', 'prioritized']
    if (jobsTypeList.includes(jobsType)) {
      const jobs = await jobQueue.getJobs(jobsType);
      let jobsUser;
      if (isAdmin) {
        jobsUser = jobs;
        // admin sees every job metadata but never another owner's key
        jobsUser.forEach(stripKeyUnlessOwner)
      } else {
        // user only see their jobs, and get their randomKey to be able to get their files
        jobsUser = jobs.filter((job: any) => isOwner(job));
      }
      return { jobs: jobsUser };
    } else if (jobId) {
      const job = await jobQueue.getJob(jobId)
      if (job) {
        if (!isAdmin && !isOwner(job)) {
          return { msg: 'job not found' };
        }
        stripKeyUnlessOwner(job);
        return { job };
      } else {
        return { msg: 'job not found' };
      }
    } else {
      let jobs:any = []
      for (const jobType of jobsTypeList) {
        const jobsTmp = await jobQueue.getJobs(jobType);
        let jobsTmpUser;
        if (isAdmin) {
          jobsTmpUser = jobsTmp;
        } else {
          jobsTmpUser = jobsTmp.filter((job: any) => isOwner(job));
        }
        jobsTmpUser.forEach((j: any) => {
          j.status = jobType;
          stripKeyUnlessOwner(j);
        });
        jobs = [...jobs, ...jobsTmpUser]
      }
      return { jobs };
    }

  }

}
