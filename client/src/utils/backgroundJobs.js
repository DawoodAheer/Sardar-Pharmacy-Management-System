import api from './api';

export async function waitForJob(queued) {
  if (!queued.jobId) return queued;
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const { data: job } = await api.get(`/jobs/${queued.jobId}`);
    if (job.status === 'completed') return { ...job.result, jobId: queued.jobId };
    if (job.status === 'failed') throw new Error(job.error || 'Background task failed.');
  }
}
