import { Router } from "express";
import { createUser, forgotPassword, resendVerificationCode, resetPassword, verifyEmailAndCreateUser, verifyResetCode, } from "../controller/userController.js";
import { loginUser } from "../controller/authController.js";
const userRouter = Router();
userRouter.post("/login", loginUser);
userRouter.post("/", createUser);
userRouter.post("/verify-email", verifyEmailAndCreateUser);
userRouter.post("/resend-verification-code", resendVerificationCode);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/verify-reset-code", verifyResetCode);
userRouter.post("/verify-forgot-password-code", verifyResetCode);
userRouter.post("/reset-password", resetPassword);
export default userRouter;
//# sourceMappingURL=userRoutes.js.map