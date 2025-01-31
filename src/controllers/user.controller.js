import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;               // putting refreshToken value in user   
        await user.save({ validateBeforeSave: false })        // saving user in db but to prevent validation check for other field as we are only want to change 1 field validateBeforeSave

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar as it is required field
    // upload on cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response from db
    // check for user creation 
    // return res


    const { fullName, email, username, password } = req.body;
    // console.log("email", req.body);

    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    // User model can talk to MongoDB directly as it is made using mongoose and server is connected. 
    // findOne returns the first document that has either username or email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }


    // now for image upload as we are using multer's middleware in route file it adds new fields in req, here it is adding files field
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"             // weird syntax, all selected by default put - sign to tell field u don't want to select 
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})


const loginUser = asyncHandler(async (req, res) => {
    // get user details from frontend req body -> data
    // username or email
    // find the user in db
    // password check
    // access and refresh token
    // send cookies

    const { username, email, password } = req.body;

    if (!(username || email)) {                   //  can be written as (!username && !email)
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(400, "User does not exist")
    }

    // user not User because methods u made are available for ur user in db and built in methods like findOne() are methods available through mongodb's mongoose 
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);       // await for surety as its async func

    const loggedInUser = await User.findById(user._id).select(                                  // updated user with added tokens
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)             // cookie from cookieParser middleware
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,                                 // es6 shorthand for accessToken: accessToken remember
                    refreshToken
                },
                "User logged in Successfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    // before logout verifyJWT middleware is running in /logout route and adding user obj in req object
    // req.user._id and get user from DB but we will directly update user to prevent few steps of getting user and then updating it
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true                   // it returns the updated res otherwise it will give res with refreshToken  
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    // take refreshToken from user and then compare it the refreshToken u r storing in DB
    // if same refreshToken present then redirect user to hit a url from where it can get a new access and refresh token

    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "UnAuthorized request")
    }

    try {                                       // kept in try catch just for safety can go without it
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        // only thing stored with refreshToken cookie is _id of user go check generateRefreshToken method in user.model
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);         // changing name as just might have conflict with user?.refreshToken

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken)
            .cookie("refreshToken", newRefreshToken)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access Token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler( async(req, res) => {
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);     // method in user model

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false})              // password encryption in done in userSchema.pre in user.model and do not want to validate other fields

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler( async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler( async(req, res) => {
    const {fullName, email} = req.body;

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        { new: true}                               // returns updated user
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler( async(req, res) => {
    const avatarLocalPath = req.file?.path;                   // file?.path not files?.avatar[0]?.path because only one file

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true}                               // returns updated user
    ).select("-password")

    // optional that delete old image using old avatar Url

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler( async(req, res) => {
    const coverImageLocalPath = req.file?.path;                   // file?.path not files?.avatar[0]?.path because only one file

    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploading on Cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true}                               // returns updated user
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username} = req.params;

    if(!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    // find user using username and apply aggregation on it 
    // can be done all in aggregation 
    // .aggregate takes array of objects where each object is a pipeline/stage returning the result down to next stage 
    // look at mongodb lookup for reference 
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",                        // not Subscribe but subscriptions as in mongoDB stores like this
                localField: "_id",
                foreignField: "channel",                      // get all subscription models having channel(having _id ref of user) field same as user._id or _id and insert a new field 
                as: "subscribers"                             // called subscribers to this user data which is an array of all subscription documents meeting the criteria of lookup 
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"                             // get all users having subscriber(having _id ref of user) field in subscription model same as user._id or _id   
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"                      // used $ for subscriber as it is a filed now
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},             // $subscribers is an array of objects, subscribers.subscriber extracts only the subscriber values. $in checks if req.user?._id exists in the extracted array [ "userA123", "userB345", "userC6767" ].
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {                                        // send only field listed here
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler( async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)                              // _id that we get is not actual mongoDB id but mongoose automatically converts _id into ObjectId of mongoDB
            }                                                                               // when we use User.find ,etc but it does not work in aggregation pipeline thats why conversion here 
        },
        {
            $lookup: {                                                       // first watchHistory has array of _id of videos then we repopulate the watchHistory array to all videos documents of same _ids
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [                                                 // sub pipeline on video before result goes of user as owner will have only _id of its owner but not the full document of user so we populate it with complete document of owner user 
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",                                    // change owner _id to whole owner's user document 
                            pipeline: [
                                {
                                    $project: {                             // project means only fields we want from user document of owner
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"                             // owner gets overwrite with first element of array of owner for ease for frontend 
                            }
                        }git 
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,                                           // first element as aggregation returns a array
            "Watch History fetched successfully"
        )
    )
})

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};