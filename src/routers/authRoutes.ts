import { Router } from "express";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
} from "../controller/authController.js";

const authRouter = Router();

authRouter.post("/login", loginUser);
authRouter.post("/refresh-token", refreshAccessToken);
authRouter.post("/logout", logoutUser);

export default authRouter;
