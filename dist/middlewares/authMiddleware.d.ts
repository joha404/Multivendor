import type { NextFunction, Request, Response } from "express";
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
export declare const authenticateUser: (request: Request, response: Response, next: NextFunction) => Promise<void>;
export declare const authorizeRoles: (...allowedRoles: string[]) => (request: Request, response: Response, next: NextFunction) => void;
//# sourceMappingURL=authMiddleware.d.ts.map