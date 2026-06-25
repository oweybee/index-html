import cron from 'node-cron';
import { runEdgeComputeCycle } from './jobs/computeEdges';

let running = false;

async function safeRun() {
  if (running) return;
  running = true;
  try {
    await runEdgeComputeCycle();
  } catch (err) {
    console.error('runEdgeComputeCycle error:', err);
  } finally {
    running = false;
  }
}

// Every 5 min: covers the 5h-to-1h pre-kickoff window
cron.schedule('*/5 * * * *', safeRun);

// Every minute: tighter polling for the final hour before kickoff.
// The cycle itself skips fixtures with no Betfair market yet, so running
// it every minute at low volume is cheap.
cron.schedule('* * * * *', safeRun);

console.log('Edge compute scheduler started');
