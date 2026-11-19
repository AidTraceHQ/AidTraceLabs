import { pool } from '../server/db.js';
import { MAX_REVERIFICATION_RUNTIME_MS, runReverification } from '../server/reverification.js';

const hardStop = setTimeout(() => {
  console.error('Scheduled re-verification exceeded its two-minute wall-clock limit.');
  process.exit(1);
}, MAX_REVERIFICATION_RUNTIME_MS);
try {
  const summary = await runReverification();
  console.log(JSON.stringify({ event: 'scheduled_reverification_complete', ...summary }));
} catch (error) {
  console.error('Scheduled re-verification failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
  clearTimeout(hardStop);
}
