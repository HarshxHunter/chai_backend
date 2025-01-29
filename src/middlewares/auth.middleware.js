import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {                   // sometimes res replaced with just _ as its not used

    try {
        // req has cookie because cookie parser middleware in app.js and if user is using mobile application in which they send 
        // custom header object having "Authorization": Bearer accessToken
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        // during jwt token creation we sent many thing like id, email, username etc, now we retrieve them using JWT
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // _id is not from mongodb but from jwt, that we only give with key _id go check generateAccessToken in user model 
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken"
        )

        if (!user) {
            throw new ApiError(401, "Invalid access Token")
        }

        // now just add new object to req object
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }

})