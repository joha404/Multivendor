import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { sendEmailMessage } from "../utils/sendEmailMessage.js";
import { createVerificationCode } from "../utils/verificationCode.js";
const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || "secret-reset-key";
const createUserSchema = z.object({
    name: z.string().trim().min(2, "Name must contain at least 2 characters"),
    email: z.string().trim().email("Please provide a valid email address"),
    password: z.string().min(6, "Password must contain at least 6 characters"),
    phone: z.string().trim().min(6).optional(),
});
const verifyEmailSchema = z.object({
    email: z.string().trim().email("Please provide a valid email address"),
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});
const forgotPasswordSchema = z.object({
    email: z.string().trim().email("Please provide a valid email address"),
});
const verifyResetCodeSchema = z.object({
    email: z.string().trim().email("Please provide a valid email address"),
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});
const resetPasswordSchema = z
    .object({
    token: z.string().trim().min(1, "Reset token is required").optional(),
    resetToken: z.string().trim().min(1, "Reset token is required").optional(),
    newPassword: z
        .string()
        .min(6, "Password must contain at least 6 characters")
        .optional(),
    password: z
        .string()
        .min(6, "Password must contain at least 6 characters")
        .optional(),
    confirmPassword: z
        .string()
        .min(6, "Confirm password must contain at least 6 characters"),
    email: z.string().trim().email().optional(),
})
    .refine((data) => Boolean(data.token || data.resetToken), {
    message: "Reset token is required",
    path: ["token"],
})
    .refine((data) => Boolean(data.newPassword || data.password), {
    message: "New password is required",
    path: ["newPassword"],
})
    .refine((data) => (data.newPassword || data.password) === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
const VERIFICATION_CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
export const createUser = async (request, response) => {
    const parsedBody = createUserSchema.safeParse(request.body);
    if (!parsedBody.success) {
        response.status(400).json({
            message: "Invalid user data",
            errors: parsedBody.error.flatten().fieldErrors,
        });
        return;
    }
    try {
        const { name, email, password, phone } = parsedBody.data;
        const normalizedEmail = email.toLowerCase();
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: normalizedEmail }, ...(phone ? [{ phone }] : [])],
            },
            select: { id: true },
        });
        if (existingUser) {
            response.status(409).json({
                message: "An account with this email or phone already exists",
            });
            return;
        }
        if (phone) {
            const pendingPhoneRegistration = await prisma.$queryRaw `
        SELECT "email" FROM "PendingRegistration" WHERE "phone" = ${phone} LIMIT 1
      `;
            if (pendingPhoneRegistration[0]?.email !== undefined &&
                pendingPhoneRegistration[0].email !== normalizedEmail) {
                response
                    .status(409)
                    .json({ message: "This phone number has a pending registration" });
                return;
            }
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const verificationCode = createVerificationCode();
        const verificationCodeHash = await bcrypt.hash(verificationCode, 12);
        const now = new Date();
        const verificationCodeExpiresAt = new Date(now.getTime() + VERIFICATION_CODE_EXPIRY_MS);
        await prisma.$executeRaw `
      INSERT INTO "PendingRegistration" (
        "id", "name", "email", "phone", "passwordHash", "verificationCodeHash",
        "verificationCodeExpiresAt", "verificationCodeSentAt", "verificationAttempts", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${name}, ${normalizedEmail}, ${phone ?? null}, ${hashedPassword}, ${verificationCodeHash},
        ${verificationCodeExpiresAt}, ${now}, 0, ${now}, ${now}
      )
      ON CONFLICT ("email") DO UPDATE SET
        "name" = EXCLUDED."name",
        "phone" = EXCLUDED."phone",
        "passwordHash" = EXCLUDED."passwordHash",
        "verificationCodeHash" = EXCLUDED."verificationCodeHash",
        "verificationCodeExpiresAt" = EXCLUDED."verificationCodeExpiresAt",
        "verificationCodeSentAt" = EXCLUDED."verificationCodeSentAt",
        "verificationAttempts" = 0,
        "updatedAt" = EXCLUDED."updatedAt"
    `;
        await sendEmailMessage({
            to: normalizedEmail,
            subject: "Verify your email address",
            verificationCode,
        });
        response.status(202).json({
            message: "Verification code sent to your email. Verify it to finish registration.",
        });
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            response
                .status(409)
                .json({ message: "Email or phone is already in use" });
            return;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2021") {
            console.error("Failed to start registration: database table does not exist");
            response.status(503).json({
                message: "Database schema is not initialized. Run the Prisma migration first.",
            });
            return;
        }
        console.error("Failed to start registration:", error);
        response.status(500).json({ message: "Unable to start registration" });
    }
};
export const verifyEmailAndCreateUser = async (request, response) => {
    const parsedBody = verifyEmailSchema.safeParse(request.body);
    if (!parsedBody.success) {
        response.status(400).json({
            message: "Invalid verification data",
            errors: parsedBody.error.flatten().fieldErrors,
        });
        return;
    }
    const { email, code } = parsedBody.data;
    const normalizedEmail = email.toLowerCase();
    try {
        const registrations = await prisma.$queryRaw `
      SELECT
        "id", "name", "email", "phone", "passwordHash", "verificationCodeHash",
        "verificationCodeExpiresAt", "verificationCodeSentAt", "verificationAttempts"
      FROM "PendingRegistration"
      WHERE "email" = ${normalizedEmail}
      LIMIT 1
    `;
        const registration = registrations[0];
        if (!registration) {
            response
                .status(404)
                .json({ message: "No pending registration found for this email" });
            return;
        }
        if (new Date(registration.verificationCodeExpiresAt) <= new Date()) {
            await prisma.$executeRaw `DELETE FROM "PendingRegistration" WHERE "id" = ${registration.id}`;
            response.status(400).json({
                message: "Verification code has expired. Please register again.",
            });
            return;
        }
        if (registration.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
            response.status(429).json({
                message: "Too many incorrect attempts. Please register again.",
            });
            return;
        }
        const isCodeValid = await bcrypt.compare(code, registration.verificationCodeHash);
        if (!isCodeValid) {
            await prisma.$executeRaw `
        UPDATE "PendingRegistration"
        SET "verificationAttempts" = "verificationAttempts" + 1, "updatedAt" = ${new Date()}
        WHERE "id" = ${registration.id}
      `;
            response.status(400).json({ message: "Invalid verification code" });
            return;
        }
        const user = await prisma.$transaction(async (transaction) => {
            const createdUser = await transaction.user.create({
                data: {
                    name: registration.name,
                    email: registration.email,
                    password: registration.passwordHash,
                    role: "GENERAL_USER",
                    ...(registration.phone ? { phone: registration.phone } : {}),
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                    status: true,
                    createdAt: true,
                },
            });
            await transaction.$executeRaw `DELETE FROM "PendingRegistration" WHERE "id" = ${registration.id}`;
            return createdUser;
        });
        response.status(201).json({
            message: "Email verified. Registration completed successfully.",
            data: user,
        });
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            response.status(409).json({
                message: "An account with this email or phone already exists",
            });
            return;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2021") {
            response.status(503).json({
                message: "Database schema is not initialized. Run the Prisma migration first.",
            });
            return;
        }
        console.error("Failed to verify email:", error);
        response.status(500).json({ message: "Unable to verify email" });
    }
};
export const resendVerificationCode = async (request, response) => {
    const parsedBody = forgotPasswordSchema.safeParse(request.body);
    if (!parsedBody.success) {
        response.status(400).json({
            message: "Invalid email address",
            errors: parsedBody.error.flatten().fieldErrors,
        });
        return;
    }
    const email = parsedBody.data.email.toLowerCase();
    try {
        const registrations = await prisma.$queryRaw `
      SELECT
        "id", "name", "email", "phone", "passwordHash", "verificationCodeHash",
        "verificationCodeExpiresAt", "verificationCodeSentAt", "verificationAttempts"
      FROM "PendingRegistration"
      WHERE "email" = ${email}
      LIMIT 1
    `;
        const registration = registrations[0];
        if (!registration) {
            response
                .status(404)
                .json({ message: "No pending registration found for this email" });
            return;
        }
        const now = new Date();
        const sentAtTime = registration.verificationCodeSentAt
            ? new Date(registration.verificationCodeSentAt).getTime()
            : 0;
        const retryAfterSeconds = Math.ceil((sentAtTime + RESEND_COOLDOWN_MS - now.getTime()) / 1000);
        if (retryAfterSeconds > 0) {
            response.status(429).json({
                message: `Please wait ${retryAfterSeconds} seconds before requesting another code`,
            });
            return;
        }
        const verificationCode = createVerificationCode();
        const verificationCodeHash = await bcrypt.hash(verificationCode, 12);
        await prisma.$executeRaw `
      UPDATE "PendingRegistration"
      SET
        "verificationCodeHash" = ${verificationCodeHash},
        "verificationCodeExpiresAt" = ${new Date(now.getTime() + VERIFICATION_CODE_EXPIRY_MS)},
        "verificationCodeSentAt" = ${now},
        "verificationAttempts" = 0,
        "updatedAt" = ${now}
      WHERE "id" = ${registration.id}
    `;
        await sendEmailMessage({
            to: email,
            subject: "Your new verification code",
            verificationCode,
        });
        response.status(202).json({
            message: "A new verification code has been sent to your email.",
        });
    }
    catch (error) {
        console.error("Failed to resend verification code:", error);
        response
            .status(500)
            .json({ message: "Unable to resend verification code" });
    }
};
export const forgotPassword = async (request, response) => {
    const parsedBody = forgotPasswordSchema.safeParse(request.body);
    if (!parsedBody.success) {
        response.status(400).json({
            message: "Invalid email address",
            errors: parsedBody.error.flatten().fieldErrors,
        });
        return;
    }
    const email = parsedBody.data.email.toLowerCase();
    const successMessage = "If an account exists for this email, a password reset code has been sent.";
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (!user) {
            response.status(202).json({ message: successMessage });
            return;
        }
        const now = new Date();
        const code = createVerificationCode();
        const codeHash = await bcrypt.hash(code, 12);
        await prisma.passwordReset.upsert({
            where: { email },
            create: {
                email,
                codeHash,
                codeExpiresAt: new Date(now.getTime() + VERIFICATION_CODE_EXPIRY_MS),
                codeSentAt: now,
                attempts: 0,
            },
            update: {
                codeHash,
                codeExpiresAt: new Date(now.getTime() + VERIFICATION_CODE_EXPIRY_MS),
                codeSentAt: now,
                attempts: 0,
            },
        });
        await sendEmailMessage({
            to: email,
            subject: "Reset your password",
            message: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
        });
        response.status(202).json({ message: successMessage });
    }
    catch (error) {
        console.error("Failed to start password reset:", error);
        response.status(500).json({ message: "Unable to start password reset" });
    }
};
export const verifyResetCode = async (request, response) => {
    const parsedBody = verifyResetCodeSchema.safeParse(request.body);
    if (!parsedBody.success) {
        response.status(400).json({
            message: "Invalid verification data",
            errors: parsedBody.error.flatten().fieldErrors,
        });
        return;
    }
    const { email, code } = parsedBody.data;
    const normalizedEmail = email.toLowerCase();
    try {
        const passwordReset = await prisma.passwordReset.findUnique({
            where: { email: normalizedEmail },
        });
        if (!passwordReset) {
            response
                .status(400)
                .json({ message: "Invalid or expired verification code" });
            return;
        }
        if (new Date(passwordReset.codeExpiresAt) <= new Date()) {
            await prisma.passwordReset.deleteMany({
                where: { email: normalizedEmail },
            });
            response
                .status(400)
                .json({ message: "Verification code has expired. Request a new one." });
            return;
        }
        if (passwordReset.attempts >= MAX_VERIFICATION_ATTEMPTS) {
            response.status(429).json({
                message: "Too many incorrect attempts. Request a new password reset code.",
            });
            return;
        }
        const isCodeValid = await bcrypt.compare(code, passwordReset.codeHash);
        if (!isCodeValid) {
            await prisma.passwordReset.update({
                where: { id: passwordReset.id },
                data: { attempts: { increment: 1 } },
            });
            response.status(400).json({ message: "Invalid verification code" });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, email: true },
        });
        if (!user) {
            response.status(404).json({ message: "User account not found" });
            return;
        }
        const token = jwt.sign({
            email: user.email,
            userId: user.id,
            purpose: "password_reset",
        }, JWT_SECRET, { expiresIn: "15m" });
        response.status(200).json({
            message: "Verification successful",
            token,
            resetToken: token,
        });
    }
    catch (error) {
        console.error("Failed to verify reset code:", error);
        response.status(500).json({ message: "Unable to verify reset code" });
    }
};
export const resetPassword = async (request, response) => {
    const parsedBody = resetPasswordSchema.safeParse(request.body);
    if (!parsedBody.success) {
        response.status(400).json({
            message: "Invalid password reset data",
            errors: parsedBody.error.flatten().fieldErrors,
        });
        return;
    }
    const { token, resetToken, newPassword, password, confirmPassword, email: providedEmail, } = parsedBody.data;
    const activeToken = token || resetToken;
    const passwordToSet = newPassword || password;
    if (!activeToken) {
        response.status(400).json({ message: "Reset token is required" });
        return;
    }
    if (!passwordToSet) {
        response.status(400).json({ message: "New password is required" });
        return;
    }
    if (passwordToSet !== confirmPassword) {
        response.status(400).json({ message: "Passwords do not match" });
        return;
    }
    try {
        let decoded;
        try {
            decoded = jwt.verify(activeToken, JWT_SECRET);
        }
        catch {
            response.status(400).json({ message: "Invalid or expired reset token" });
            return;
        }
        if (decoded.purpose !== "password_reset" || !decoded.email) {
            response.status(400).json({ message: "Invalid reset token" });
            return;
        }
        const email = decoded.email.toLowerCase();
        if (providedEmail && providedEmail.toLowerCase() !== email) {
            response
                .status(400)
                .json({ message: "Email does not match reset token" });
            return;
        }
        const passwordReset = await prisma.passwordReset.findUnique({
            where: { email },
        });
        if (!passwordReset) {
            response.status(400).json({
                message: "Password reset session has expired or was already used",
            });
            return;
        }
        const hashedPassword = await bcrypt.hash(passwordToSet, 12);
        await prisma.$transaction(async (transaction) => {
            const updateResult = await transaction.user.updateMany({
                where: { email },
                data: { password: hashedPassword },
            });
            if (updateResult.count !== 1) {
                throw new Error("User account was not found");
            }
            await transaction.passwordReset.deleteMany({
                where: { email },
            });
        });
        response.status(200).json({ message: "Password reset successfully." });
    }
    catch (error) {
        console.error("Failed to reset password:", error);
        response.status(500).json({ message: "Unable to reset password" });
    }
};
//# sourceMappingURL=userController.js.map