import type { Request, Response } from "express";
export declare const createUser: (request: Request, response: Response) => Promise<void>;
export declare const verifyEmailAndCreateUser: (request: Request, response: Response) => Promise<void>;
export declare const resendVerificationCode: (request: Request, response: Response) => Promise<void>;
export declare const forgotPassword: (request: Request, response: Response) => Promise<void>;
export declare const verifyResetCode: (request: Request, response: Response) => Promise<void>;
export declare const resetPassword: (request: Request, response: Response) => Promise<void>;
//# sourceMappingURL=userController.d.ts.map