const mongoose=require("mongoose");


mongoose.connect('mongodb://127.0.0.1:27017/ChatApp')
.then(()=>{
    console.log("Connected to Database")
})
.catch((error)=>{
    console.log("Error Connecting to the database",error);
});

