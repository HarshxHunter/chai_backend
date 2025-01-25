const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))  // returning a promise
    }
}


export {asyncHandler}

// asyncHandler is a higher order function so it takes a function as a parameter and return a function
// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {}} or (func) => () => {}
// const asyncHandler = (func) => async () => {} 


// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// } 