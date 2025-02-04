import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video Id")
    }

    const likedAlready = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    if(likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }));
    }

    await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }));
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId");
    }

    const likedAlready = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id,
    });

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }));
    }

    await Like.create({
        comment: commentId,
        likedBy: req.user?._id,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }));

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const likedAlready = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id,
    });

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);

        return res
            .status(200)
            .json(new ApiResponse(200, { tweetId, isLiked: false }));
    }

    await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }));
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query; // Extract pagination params

    const pipeline = [
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideos"
            }
        },
        {
            $unwind: "$likedVideos"                       //$unwind does not filter out videos but instead deconstructs an array field, returning a separate document for each element in the array.
        },
        {
            $sort: {
                "likedVideos.createdAt": -1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "likedVideos.owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },
        {
            $unwind: "$ownerDetails"
        },
        {
            $project: {
                _id: 0,
                likedVideos: {
                    _id: 1,
                    videoFile: 1,
                    thumbnail: 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullName: 1,
                        avatar: 1
                    }
                }
            }
        }
    ];

    // Paginate the results using aggregatePaginate
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const likedVideoAggregate = await Like.aggregatePaginate(Like.aggregate(pipeline), options);

    return res.status(200).json(
        new ApiResponse(200, likedVideoAggregate, "Liked videos fetched successfully")
    );
});


// const getLikedVideos = asyncHandler(async (req, res) => {

//     const likedVideoAggregate = await Like.aggregate([
//         {
//             $match: {
//                 likedBy: new mongoose.Types.ObjectId(req.user?._id)
//             }
//         },
//         {
//             $lookup: {
//                 from: "videos",
//                 localField: "video",
//                 foreignField: "_id",
//                 as: "likedVideos",
//                 pipeline: [
//                     {
//                         $lookup: {
//                             from: "users",
//                             localField: "likedBy",
//                             foreignField: "_id",
//                             as: "ownerDetails"
//                         }
//                     },
//                     {
//                         $unwind: "$ownerDetails"
//                     }
//                 ]
//             }
//         },
//         {
//             $unwind: "$likedVideos"
//         },
//         {
//             $sort: {
//                 createdAt: -1
//             }
//         },
//         {
//             $project: {
//                 _id: 0,
//                 likedVideos: {
//                     _id: 1,
//                     videoFile: 1,
//                     thumbnail: 1,
//                     owner: 1,
//                     title: 1,
//                     description: 1,
//                     views: 1,
//                     duration: 1,
//                     createdAt: 1,
//                     isPublished: 1,
//                     ownerDetails: {
//                         username: 1,
//                         fullName: 1,
//                         "avatar.url": 1,
//                     },
//                 }
//             }
//         }
//     ]);

//     return res
//         .status(200)
//         .json(
//             new ApiResponse(
//                 200,
//                 likedVideoAggregate,
//                 "liked videos fetched successfully"
//             )
//         );
// })

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}