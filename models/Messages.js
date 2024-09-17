const mongoose=require("mongoose");

const msgSchema=mongoose.Schema({
    conversationId:{
        type:String,
    },
    senderId:{
        type:String,
    },
    message:{
        type:String,
    },
    isImage:{
        type:Boolean,
        default:false
    }
});

const Messages=mongoose.model('messages',msgSchema);

module.exports=Messages;