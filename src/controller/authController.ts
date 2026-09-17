import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../config/db.js";

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET_KEY ||
  process.env.JWT_SECRET ||
  "access-secret-key";

const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_SECRET_KEY ||
  process.env.JWT_SECRET ||
  "refresh-secret-key";

const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "1d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
});

export const loginUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const parsedBody = loginSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json({
      message: "Invalid login data",
      errors: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsedBody.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        sellerProfile: {
          select: {
            id: true,
            shopName: true,
            shopSlug: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!user) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (user.isDeleted || user.status === "DELETED") {
      response.status(403).json({
        message:
          "This account has been deleted. Please contact support to recover your account.",
      });
      return;
    }

    if (user.status === "BANNED") {
      response.status(403).json({
        message: "Your account has been banned. Please contact support.",
      });
      return;
    }

    if (user.status === "SUSPENDED") {
      response.status(403).json({
        message: "Your account has been suspended. Please contact support.",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const signOptions: jwt.SignOptions = {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "1d") as any,
    };

    const refreshSignOptions: jwt.SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as any,
    };

    const accessToken = jwt.sign(tokenPayload, JWT_ACCESS_SECRET, signOptions);
    const refreshToken = jwt.sign(
      tokenPayload,
      JWT_REFRESH_SECRET,
      refreshSignOptions,
    );

    const refreshTokenExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    try {
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: refreshTokenExpiresAt,
        },
      });
    } catch (tokenError) {
      console.error("Failed to save refresh token:", tokenError);
    }

    response.status(200).json({
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          sellerProfile: user.sellerProfile,
        },
        accessToken,
        refreshToken,
        token: accessToken,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    response.status(500).json({ message: "Unable to log in at this time" });
  }
};

export const refreshAccessToken = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const parsedBody = refreshTokenSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json({
      message: "Invalid token data",
      errors: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { refreshToken } = parsedBody.data;

  try {
    let decoded: { userId?: string; email?: string; role?: string };

    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
        userId?: string;
        email?: string;
        role?: string;
      };
    } catch {
      response
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
      return;
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord || new Date(tokenRecord.expiresAt) <= new Date()) {
      response
        .status(401)
        .json({ message: "Refresh token is invalid or expired" });
      return;
    }

    if (!decoded.userId) {
      response.status(401).json({ message: "Invalid refresh token payload" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      response
        .status(401)
        .json({ message: "User account is inactive or not found" });
      return;
    }

    const signOptions: jwt.SignOptions = {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "1d") as any,
    };

    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_ACCESS_SECRET,
      signOptions,
    );

    response.status(200).json({
      message: "Access token refreshed successfully",
      accessToken: newAccessToken,
      token: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    response.status(500).json({ message: "Unable to refresh access token" });
  }
};

export const logoutUser = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const refreshToken = request.body?.refreshToken as string | undefined;
  const authHeader = request.headers.authorization;

  if (refreshToken && typeof refreshToken === "string") {
    try {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
      response.status(200).json({ message: "Logged out successfully" });
      return;
    } catch (error) {
      console.error("Logout error:", error);
      response.status(500).json({ message: "Unable to log out at this time" });
      return;
    }
  }

  if (request.user?.userId) {
    try {
      await prisma.refreshToken.deleteMany({
        where: { userId: request.user.userId },
      });
      response.status(200).json({ message: "Logged out successfully" });
      return;
    } catch (error) {
      console.error("Logout error:", error);
      response.status(500).json({ message: "Unable to log out at this time" });
      return;
    }
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as {
          userId?: string;
        };
        if (decoded.userId) {
          await prisma.refreshToken.deleteMany({
            where: { userId: decoded.userId },
          });
          response.status(200).json({ message: "Logged out successfully" });
          return;
        }
      } catch {
        response.status(200).json({ message: "Logged out successfully" });
        return;
      }
    }
  }

  response.status(400).json({
    message:
      "Refresh token or Authorization Bearer header is required to log out",
  });
};
