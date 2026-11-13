import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  getUserByIdData,
  getUsersData,
  updateCustomerStatus,
  deleteCustomer,
} from "../../services/admin/userAdminService.js";

export const getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const data = await getUsersData({ page, limit, skip });
    return handleResponse(res, 200, "Users fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserByIdData(id);

    if (!user) {
      return handleResponse(res, 404, "Customer not found");
    }

    return handleResponse(
      res,
      200,
      "Customer details fetched successfully",
      user,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateUser = async (req, res) => {
  try {
    if (typeof req.body?.isActive !== "boolean") {
      return handleResponse(res, 400, "isActive must be a boolean");
    }
    const user = await updateCustomerStatus(req.params.id, req.body.isActive);
    if (!user) return handleResponse(res, 404, "Customer not found");
    return handleResponse(res, 200, "Customer status updated successfully", {
      id: user._id,
      isActive: user.isActive,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const removeUser = async (req, res) => {
  try {
    const user = await deleteCustomer(req.params.id);
    if (!user) return handleResponse(res, 404, "Customer not found");
    return handleResponse(res, 200, "Customer deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
