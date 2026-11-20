import { pool } from '../server/db.js';
import { notificationConfig } from '../server/notification-config.js';
import { processDueDeliveries } from '../server/notifications.js';

// Each batch is bounded by the per-delivery connect/read timeouts and the 25-item claim limit.
const hardStopMs = 5 * 60 * 1000;
const hardStop = setTimeout(() => {
  console.error('Notification delivery exceeded its five-minute wall-clock limit.');
  process.exit(1);
}, hardStopMs);
try {
  if (!notificationConfig().enabled) {
    console.log(JSON.stringify({ event: 'notification_delivery_skipped', reason: 'disabled' }));
  } else {
    // Only counts are logged; URLs, secrets and payloads never are.
    const summary = await processDueDeliveries();
    console.log(JSON.stringify({ event: 'notification_delivery_complete', ...summary }));
  }
} catch (error) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
  console.error(`Notification delivery failed (${code}).`);
  process.exitCode = 1;
} finally {
  await pool.end();
  clearTimeout(hardStop);
}
