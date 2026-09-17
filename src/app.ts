import express from "express";
import authRouter from "./routers/authRoutes.js";
import userRouter from "./routers/userRoutes.js";

const app = express();

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);

app.get("/", (_request, response) => {
  response.status(200).send("Hey Developer !!! Server is running");
});

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found" });
});

export default app;
