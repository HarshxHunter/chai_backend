// require('dotenv').config({ path: './env'})
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path: './env'
})



connectDB()













/*import express from "express";
// Immediately Invoked Function Expressions (IIFE) 
// semicolon before IIFE because problem can arise if previous line did'nt had a ; so as a precaution put ; before IIFE

const app = express();

( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log("Error:", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
            
        })
    } catch(error) {
        console.log("ERROR", error);
        throw error;
    }
})()
*/