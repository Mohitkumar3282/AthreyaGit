import { bulkProcessPayouts } from "../services/finance/payoutService.js";
import logger from "../services/logger.js";

const PAYOUT_BATCH_INTERVAL_MS = () =>
  parseInt(process.env.PAYOUT_BATCH_INTERVAL_MS || "86400000", 10);

/**
 * Payout batch job handler
 * Processes pending payouts in batches
 */
const payoutBatchJobHandler = async () => {
  const startTime = Date.now();
  
  try {
    // Daily settlement: payouts are already net of the agreed commission
    // (paymentBreakdown.sellerPayoutTotal), so drain every eligible payout
    // in batches and credit the remainder to the seller wallet.
    const batchLimit = parseInt(process.env.PAYOUT_BATCH_LIMIT || "200", 10);
    const result = { total: 0, completed: 0, failed: 0 };
    for (let round = 0; round < 100; round += 1) {
      const batch = await bulkProcessPayouts({
        limit: batchLimit,
        remarks: "Daily settlement (net of commission)",
      });
      result.total += batch.total;
      result.completed += batch.completed;
      result.failed += batch.failed;
      if (batch.completed === 0) break;
    }
    
    const duration = Date.now() - startTime;
    
    if (result.completed > 0 || result.failed > 0) {
      logger.info('Payout batch job completed', {
        jobName: 'payoutBatchJob',
        duration,
        completed: result.completed,
        failed: result.failed,
        total: result.total
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Payout batch job failed', {
      jobName: 'payoutBatchJob',
      duration,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Start payout batch job using distributed scheduler
 * This function is now a no-op - the distributed scheduler handles registration
 */
export default function startPayoutBatchJob() {
  // This function is now a no-op - the distributed scheduler handles registration
  // Kept for backward compatibility
  if (!isPayoutBatchJobEnabled()) {
    return;
  }
  logger.warn('startPayoutBatchJob called directly - use distributed scheduler instead');
}

/**
 * Get the job handler function for distributed scheduler registration
 * @returns {Function}
 */
export const getPayoutBatchJobHandler = () => payoutBatchJobHandler;

/**
 * Get the job interval in milliseconds
 * @returns {number}
 */
export const getPayoutBatchJobInterval = () => PAYOUT_BATCH_INTERVAL_MS();

/**
 * Check if payout batch job is enabled
 * @returns {boolean}
 */
// On by default so settlement runs every 24h; set ENABLE_PAYOUT_BATCH_JOB=false to disable.
export const isPayoutBatchJobEnabled = () => process.env.ENABLE_PAYOUT_BATCH_JOB !== "false";
