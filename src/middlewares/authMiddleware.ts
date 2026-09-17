import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET_KEY ||
  process.env.JWT_SECRET ||
  "access-secret-key";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateUser = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).json({
      message: "Authentication required. Please provide a Bearer token.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    response.status(401).json({ message: "Bearer token is missing" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as {
      userId?: string;
      email?: string;
      role?: string;
    };

    if (!decoded.userId || !decoded.email) {
      response.status(401).json({ message: "Invalid access token payload" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        isDeleted: true,
      },
    });

    if (!user) {
      response.status(401).json({ message: "User account no longer exists" });
      return;
    }

    if (user.isDeleted || user.status === "DELETED") {
      response
        .status(403)
        .json({ message: "Account has been deleted or deactivated" });
      return;
    }

    if (user.status === "BANNED") {
      response.status(403).json({ message: "Your account has been banned" });
      return;
    }

    if (user.status === "SUSPENDED") {
      response.status(403).json({ message: "Your account has been suspended" });
      return;
    }

    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ message: "Access token has expired" });
      return;
    }
    response.status(401).json({ message: "Invalid access token" });
  }
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      response.status(403).json({
        message: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
};
