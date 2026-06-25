import cron from 'node-cron';
import { runEdgeComputeCycle } from './jobs/computeEdges';
import { discoverAndMapFixtures } from './jobs/discoverFixtures';
import { ingestPredictions } from './jobs/ingestPredictions';
import { ingestTeamStats } from './jobs/ingestTeamStats';
import { ingestLineups } from './jobs/ingestLineups';

async function safe(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[${name}] error:`, err);
  }
}

let edgeRunning = false;

async function runEdge() {
  if (edgeRunning) return;
  edgeRunning = true;
  try {
    await runEdgeComputeCycle();
  } catch (err) {
    console.error('[edge] error:', err);
  } finally {
    edgeRunning = false;
  }
}

// Every 30 min: fixture discovery, predictions (once per fixture), team stats (daily cadence)
cron.schedule('*/30 * * * *', async () => {
  await safe('discoverFixtures', discoverAndMapFixtures);
  await safe('ingestPredictions', ingestPredictions);
  await safe('ingestTeamStats', ingestTeamStats);
});

// Every 5 min: edge compute (5h-to-1h pre-kickoff window)
cron.schedule('*/5 * * * *', runEdge);

// Every 1 min: edge compute + lineups (final 90 min before kickoff)
cron.schedule('* * * * *', async () => {
  await runEdge();
  await safe('ingestLineups', ingestLineups);
});

console.log('Engine scheduler started');
