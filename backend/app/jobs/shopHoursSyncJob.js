import logger from "../services/logger.js";
import { syncShopOpenStatus } from "../services/shopHoursService.js";

const INTERVAL_MS = parseInt(process.env.SHOP_HOURS_SYNC_INTERVAL_MS || "60000", 10);

/** Opens/closes every shop automatically from its store timings. */
const run = async () => {
  try {
    const changed = await syncShopOpenStatus();
    if (changed > 0) {
      logger.info("Shop hours sync updated shops", { jobName: "shopHoursSyncJob", changed });
    }
  } catch (err) {
    logger.error("Shop hours sync failed", { jobName: "shopHoursSyncJob", error: err.message });
  }
};

export const getShopHoursSyncJobHandler = () => run;
export const getShopHoursSyncJobInterval = () => INTERVAL_MS;
export default run;
