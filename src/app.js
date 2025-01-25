import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({ limit: "16kb"}))
app.use(express.urlencoded({ extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes import
import userRouter from "./routes/user.routes.js"


//routes declaration
//before it was app.get('/user') but now .use() because router is not inside this file we are exporting it from another file 
// and import it here we have to use a middleware .use() to pass on the control to userRouter
//industry practice to add /api/v1 as prefix so it will look like http://localhost:8000/api/v1/users/register

app.use("/api/v1/users", userRouter)

export { app } 