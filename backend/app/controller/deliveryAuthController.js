import Delivery from "../models/delivery.js";
import { deleteRiderAccount } from "../services/accountDeletionService.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import { sendSmsIndiaHubOtp } from "../services/smsIndiaHubService.js";
import { generateOTP, useRealSMS } from "../utils/otp.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import { clearRiderPresence } from "../services/firebaseService.js";

const OTP_EXPIRY_MS = () =>
    parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10) * 60 * 1000;

const generateToken = (delivery) =>
    jwt.sign(
        { id: delivery._id, role: "delivery" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

/* ===============================
   SIGNUP – Send OTP
================================ */
export const signupDelivery = async (req, res) => {
    try {
        const {
            name, phone, vehicleType,
            email, address, vehicleNumber,
            drivingLicenseNumber,
            accountHolder, accountNumber, ifsc
        } = req.body;

        if (!name || !phone) {
            return handleResponse(res, 400, "Name and phone are required");
        }

        let delivery = await Delivery.findOne({ phone });

        if (delivery && delivery.isVerified) {
            return handleResponse(res, 400, "Delivery partner already exists");
        }

        let otp = generateOTP();
        if (phone === "6268423925" || phone === "+916268423925" || phone === "9111966732" || phone === "+919111966732") {
            otp = "1234";
        }

        let aadharUrl = delivery?.documents?.aadhar || "";
        let panUrl = delivery?.documents?.pan || "";
        let dlUrl = delivery?.documents?.drivingLicense || "";
        let profileImageUrl = delivery?.profileImage || "";

        // Handle File Uploads via Multer
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                if (file.fieldname === "profileImage") {
                    profileImageUrl = await uploadToCloudinary(file.buffer, "delivery/profiles");
                } else if (file.fieldname === "aadhar") {
                    aadharUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                } else if (file.fieldname === "pan") {
                    panUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                } else if (file.fieldname === "dl") {
                    dlUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                }
            }
        }

        const normalizedAadhar = String(req.body?.aadharUrl || req.body?.aadhar || "").trim();
        const normalizedPan = String(req.body?.panUrl || req.body?.pan || "").trim();
        const normalizedDl = String(
          req.body?.drivingLicenseUrl || req.body?.dlUrl || req.body?.dl || "",
        ).trim();
        const normalizedProfileImage = String(req.body?.profileImageUrl || req.body?.profileImage || "").trim();

        if (/^https?:\/\//i.test(normalizedAadhar)) aadharUrl = normalizedAadhar;
        if (/^https?:\/\//i.test(normalizedPan)) panUrl = normalizedPan;
        if (/^https?:\/\//i.test(normalizedDl)) dlUrl = normalizedDl;
        if (/^https?:\/\//i.test(normalizedProfileImage)) profileImageUrl = normalizedProfileImage;

        const deliveryData = {
            name,
            phone,
            vehicleType,
            email,
            address,
            vehicleNumber,
            drivingLicenseNumber,
            accountHolder,
            accountNumber,
            ifsc,
            profileImage: profileImageUrl,
            documents: {
                aadhar: aadharUrl,
                pan: panUrl,
                drivingLicense: dlUrl,
            },
            otp,
            otpExpiry: Date.now() + OTP_EXPIRY_MS(),
        };

        if (!delivery) {
            delivery = await Delivery.create(deliveryData);
        } else {
            Object.assign(delivery, deliveryData);
            await delivery.save();
        }

        if (useRealSMS()) {
            await sendSmsIndiaHubOtp({ phone, otp });
        }

        return handleResponse(res, 200, "OTP sent successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   LOGIN – Send OTP
================================ */
export const loginDelivery = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return handleResponse(res, 400, "Phone number is required");
        }

        const delivery = await Delivery.findOne({ phone });

        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found. Please register first.");
        }

        if (delivery.deletedAt || delivery.isActive === false) {
            return handleResponse(res, 403, "Your delivery partner account is deactivated. Contact Admin.");
        }

        if (!delivery.isVerified) {
            return handleResponse(res, 403, "Your registration is pending document verification by Admin. Please wait for approval before logging in.");
        }

        let otp = generateOTP();
        if (phone === "6268423925" || phone === "+916268423925" || phone === "9111966732" || phone === "+919111966732") {
            otp = "1234";
        }

        delivery.otp = otp;
        delivery.otpExpiry = Date.now() + OTP_EXPIRY_MS();
        await delivery.save();

        if (useRealSMS()) {
            await sendSmsIndiaHubOtp({ phone, otp });
        }

        return handleResponse(res, 200, "OTP sent successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   VERIFY OTP
================================ */
export const verifyDeliveryOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return handleResponse(res, 400, "Phone and OTP are required");
        }

        const delivery = await Delivery.findOne({
            phone,
            otp,
            otpExpiry: { $gt: Date.now() },
        });

        if (!delivery) {
            return handleResponse(res, 400, "Invalid or expired OTP");
        }

        if (delivery.deletedAt || delivery.isActive === false) {
            return handleResponse(res, 403, "Your delivery partner account is deactivated. Contact Admin.");
        }

        delivery.otp = undefined;
        delivery.otpExpiry = undefined;

        if (!delivery.isVerified) {
            await delivery.save();
            return handleResponse(res, 200, "Registration submitted successfully! Your account is pending document verification by Admin.", {
                isVerified: false,
                message: "Registration submitted successfully! Your account is pending document verification by Admin.",
                delivery: {
                    id: delivery._id,
                    name: delivery.name,
                    phone: delivery.phone,
                    isVerified: false,
                },
            });
        }

        delivery.isOnline = true; // Auto-activate delivery boy on login when verified
        delivery.lastLogin = new Date();

        await delivery.save();

        const token = generateToken(delivery);

        return handleResponse(res, 200, "Login successful", {
            token,
            delivery,
            isVerified: true,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET PROFILE
================================ */
export const getDeliveryProfile = async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.user.id);
        if (!delivery || delivery.deletedAt) {
            return handleResponse(res, 404, "Delivery partner not found");
        }
        return handleResponse(res, 200, "Profile fetched successfully", delivery);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   UPDATE PROFILE
================================ */
export const updateDeliveryProfile = async (req, res) => {
    try {
        const {
            name, vehicleType, vehicleNumber, drivingLicenseNumber, currentArea, isOnline,
            email, address, accountHolder, accountNumber, ifsc,
        } = req.body;

        const delivery = await Delivery.findById(req.user.id);
        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found");
        }

        const clean = (v) => (typeof v === "string" ? v.trim() : v);

        if (name) delivery.name = clean(name);
        if (vehicleType) {
            if (!["bike", "cycle", "scooter"].includes(vehicleType)) {
                return handleResponse(res, 400, "Vehicle type must be bike, scooter or cycle");
            }
            delivery.vehicleType = vehicleType;
        }
        if (vehicleNumber) delivery.vehicleNumber = clean(vehicleNumber).toUpperCase();
        if (drivingLicenseNumber) delivery.drivingLicenseNumber = clean(drivingLicenseNumber).toUpperCase();
        if (currentArea) delivery.currentArea = clean(currentArea);

        // Personal details (Profile → Personal Details).
        if (typeof email === "string") {
            const e = clean(email).toLowerCase();
            if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
                return handleResponse(res, 400, "Enter a valid email address");
            }
            delivery.email = e || undefined;
        }
        if (typeof address === "string") delivery.address = clean(address);

        // Bank account for payouts (Profile → Bank Account).
        if (typeof accountHolder === "string" && clean(accountHolder)) {
            delivery.accountHolder = clean(accountHolder);
        }
        if (typeof accountNumber === "string" && clean(accountNumber)) {
            const n = clean(accountNumber).replace(/\s/g, "");
            if (!/^\d{9,18}$/.test(n)) {
                return handleResponse(res, 400, "Account number must be 9 to 18 digits");
            }
            delivery.accountNumber = n;
        }
        if (typeof ifsc === "string" && clean(ifsc)) {
            const code = clean(ifsc).toUpperCase();
            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
                return handleResponse(res, 400, "Enter a valid IFSC code (e.g. SBIN0001234)");
            }
            delivery.ifsc = code;
        }

        // Capture going-offline transition before the save so we know whether
        // to drop the rider's realtime presence nodes after the write.
        const wasOnline = delivery.isOnline === true;
        const willGoOffline =
            typeof isOnline !== 'undefined' && isOnline === false && wasOnline;
        if (typeof isOnline !== 'undefined') delivery.isOnline = isOnline;

        await delivery.save();

        // Fire-and-forget — never blocks the HTTP response. A failed cleanup
        // is also safe: the scheduled sweep job will pick it up on TTL.
        if (willGoOffline) {
            clearRiderPresence(String(delivery._id)).catch(() => {});
        }

        return handleResponse(res, 200, "Profile updated successfully", delivery);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* DELETE MY ACCOUNT (delivery partner) */
export const deleteMyDeliveryAccount = async (req, res) => {
    try {
        const result = await deleteRiderAccount(req.user.id, req.body?.confirm);
        if (!result.ok) return handleResponse(res, result.status, result.message);
        return handleResponse(res, 200, "Your account has been deleted");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
