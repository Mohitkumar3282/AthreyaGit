import handleResponse from "../utils/helper.js";
import {
  getRiderIncentiveStatus,
  startBreak,
  endBreak,
} from "../services/delivery/riderIncentiveService.js";

// GET /delivery/incentives - live rules + this rider's progress
export const getMyIncentives = async (req, res) => {
  try {
    return handleResponse(res, 200, "Incentives fetched", await getRiderIncentiveStatus(req.user.id));
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

// POST /delivery/break { minutes }
export const startMyBreak = async (req, res) => {
  try {
    const breakUntil = await startBreak(req.user.id, req.body?.minutes);
    return handleResponse(res, 200, "Break started", { breakUntil });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

// DELETE /delivery/break
export const endMyBreak = async (req, res) => {
  try {
    await endBreak(req.user.id);
    return handleResponse(res, 200, "Break ended", { breakUntil: null });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
