const mongoose=require("mongoose");

const groupSchema=mongoose.Schema({
    groupName:{
        type:String,
        required:true
    },
    groupDesc:{
        type:String,
        required:true
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    members:{
        type: [mongoose.Schema.Types.ObjectId], // Array of ObjectIds (assuming member IDs refer to another collection, like 'User')
        ref: 'User',
    },
});

const Groups=mongoose.model('groups',groupSchema);

module.exports=Groups;