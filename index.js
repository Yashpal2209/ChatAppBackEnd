const express=require("express");
const bcrypt=require("bcrypt");
require("./db/connnection");
const jwt=require("jsonwebtoken");
const cors=require("cors");
const multer=require("multer");
const path=require("path");
const { v4: uuidv4 } = require('uuid'); 

const mongoose=require("mongoose");
//IMport files
const User=require("./models/user");
const Conversation=require("./models/Converation");
const Message=require("./models/Messages");
const Groups=require("./models/Groups")
const io=require('socket.io')(8000,{
    cors:{
        origin:'http://localhost:5173'
    }
});

const app=express();
const port=process.env.PORT || 3000;

const groups={};

cors:(3000,{
    origin:'http://localhost:5173'
})

let users=[]

//socket io
io.on('connection',socket=>{
    console.log('User connected',socket.id);

    socket.on('addUser',userId=>{
        const isUserExist=users.find(user=>user.userId===userId);
        if(!isUserExist){
            const user={userId,socketId:socket.id}
            users.push(user);
            io.emit('getUsers',users);
        }
        
    })


    socket.on('sendMessage',async ({senderId,receiverId,message,conversationId,isImage})=>{
        const receiver=users.find(user=>user.userId===receiverId);
        const sender=users.find(user=>user.userId===senderId);
        const user=await User.findById(senderId);
        console.log(isImage);
        console.log(message);
        if(receiver){
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage',{
                senderId,
                message,
                conversationId,
                receiverId,
                user:{id:user._id,fullName:user.fullName,email:user.email},
                isImage
            });
        }else{
            io.to(sender.socketId).emit('getMessage',{
                senderId,
                message,
                conversationId,
                receiverId,
                user:{id:user._id,fullName:user.fullName,email:user.email},
                isImage
            });
        }
    });

    socket.on('sendGroupMessage',async ({senderId,receiverId,message,conversationId,isImage})=>{
        // const receiver=users.find(user=>user.userId===receiverId);
        const sender=users.find(user=>user.userId===senderId);
        console.log("users",users);
        const user=await User.findById(senderId);
        // console.log(isImage);
        console.log("dfghjk",receiverId);
        
        const group=await Groups.find({_id:receiverId});
        console.log("grpou",group);
        // const receiver=users.find(user=>user.userId===receiverId);
        // const sender=users.find(user=>user.userId===senderId);
        if(group.length>0){
            const members=group[0].members;
            // console.log("memmbers",members);
            for(const memberId of members){
                // console.log("memId",memberId);
                const member=users.find((user)=>{
                    // console.log("user",user);
                    if(user.userId==memberId){
                        return user;
                    }
                });
                // const member=await User.find({_id:memberId});
                // console.log("mem",member);
                if(member){
                    console.log("hii",member.socketId);
                    io.to(member.socketId).emit('getGroupMessage',{
                        senderId,
                        message,
                        conversationId,
                        receiverId,
                        user:{id:user._id,fullName:user.fullName,email:user.email},
                        isImage
                    });
                }
            };
        }

        // io.to(receiverId).to(sender.socketId).emit('getGroupMessage',{
        //     senderId,
        //     message,
        //     conversationId,
        //     receiverId,
        //     user:{id:user._id,fullName:user.fullName,email:user.email},
        //     isImage
        // });
    });

    socket.on('createGroup',({groupName,groupDesc,userId})=>{
        const group=new Groups({
            groupName:groupName,
            groupDesc:groupDesc,
            createdBy:userId,
            members:[userId]
        });
        group.save();//group created
        const id=(group._id).toString();
        console.log(id);
        socket.join(id);
        
        const conversation=new Conversation({
            members:[userId,id]
        });

        conversation.save();
        const user=users.find(user=>user.userId==userId);
        console.log("user",user);
        io.to(user.socketId).emit("groupCreated",{
            id:group._id, 
            groupName:groupName,
            groupDesc:groupDesc,
            createdBy:userId,
            members:[userId],
            conversationId:conversation._id,
        });
    });

    socket.on("leaveGroup",async ({groupId,userId})=>{
        const group=await Groups.find({_id:groupId,createdBy:userId});
        if(group.length>0){
            //now we will delete the group from the databse and delete all the conversations whose member includes the groupId
            await Groups.findByIdAndDelete(new mongoose.Types.ObjectId(groupId));
            await Conversation.deleteMany({members:{$in:[groupId]}});
            // const user=users.find(user=>user.userId==userId);
            const members=group[0].members;
            for(const member of members){
                const usert=users.find(user=>user.userId==member);
                io.to(usert?.socketId).emit("leaveusGroup",{
                    groupId,
                })
            }
            // io.to(user?.socketId).emit("leaveusGroup",{
            //     groupId,
            // });

        }else{
        const updatedGroup = await Groups.findByIdAndUpdate(
            new mongoose.Types.ObjectId(groupId),
            { $pull: { members: new mongoose.Types.ObjectId(userId) } }, // Use $pull to remove the member
            { new: true } // Return the updated document
        );
        await Conversation.deleteMany({
            members:{
                $all:[groupId,userId],
            }
        });
        const user1=users.find(user=>user.userId==userId);
        const members=updatedGroup.members;
        const user = await User.find({_id:userId});
        io.to(user1?.socketId).emit("leavemeGroup",{
            name:user?.fullName,
            group:updatedGroup
        });
        
        for(const member of members){
            const usert=users.find(user=>user.userId==member);
            io.to(usert?.socketId).emit("leaveGroup",{
                name:user?.fullName,
                group:updatedGroup
            })
        }}
        
    })

    socket.on('disconnect',()=>{
        users=users.filter(user=>user.socketId!==socket.id);
        io.emit('getUsers',users);
    })

})

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors());
app.use(express.static(path.resolve('./public')))



const storage=multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads');
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload=multer({storage:storage});

app.get("/",(req,res)=>{
    res.write("<h1>Hello</h1>");
    res.end();
})

app.post('/api/register',async (req,res)=>{
    try{
        const {fullName,email,password}=req.body;

        if(!fullName.trim() || !email.trim() || !password.trim()){
            return res.status(400).send("Please fill all required fields");
        }else{
            const userExist=await User.findOne({email:email});

            if(userExist){
                return res.status(400).send("User already exists");
            }else{
                bcrypt.hash(password,10,(err,hashedPassword)=>{
                    if(err){
                        console.log(err);
                        return res.status(500).send("Server Error");
                    }else{
                        const newUser=new User({
                            fullName:fullName,
                            email:email,
                            password:hashedPassword,
                        });
                        newUser.save();
                        console.log("User created successfully");
                        return res.status(200).send("User Registered successfullly");
                    }
                    
                });
                

            }

        }



    }catch(error){
        console.log(error);
        return res.status(500).send("These some error");
    }
});

app.post("/api/login",async (req,res)=>{
    try{
        const {email,password}=req.body;
        
        if(!email.trim() || !password.trim()){
            return res.status(400).send("All field are required");
        }else{
            
            const user=await User.findOne({email});
            if(!user){
                return res.status(400).send('User email is Incorrect');
            }else{
                const validateUser=await bcrypt.compare(password,user.password);
                if(!validateUser){
                    return res.status(400).send('User password is Incorrect');
                }
                // console.log(3)
                const payload={
                    userId:user._id,
                    email:email,
                }
                const secretkey=process.env.JWT_SECRET_KEY||"This is jwt key";
                jwt.sign(payload,secretkey,{expiresIn:84600},async(err,token)=>{
                    await User.updateOne({id:user._id},{
                        $set:{token}
                    });
                    user.save();
                    console.log("Login Successfully");
                    return res.status(200).json({user:{id:user._id,email:user.email,fullName:user.fullName},token});
                });
                // console.log(4)
            }
        }
    }catch(error){
        return res.send("Error in server");
    }
});

app.post("/api/conversation",async(req,res)=>{
    try{
        const {senderId,receiverId}=req.body;
        const newConversation=new Conversation({
            members:[senderId,receiverId]
        });
        await newConversation.save();
        return res.status(200).send("Conversation created Successfully");
    }catch(error){
        return res.status(500).send("Error")
    }
});

app.get("/api/conversation/:userId",async (req,res)=>{
    try{
        const userId=req.params.userId;
        // console.log(userId);
        const conversations=await Conversation.find({
            members:{
                $in:[userId]
            }
        });
        const conversationUserData=Promise.all(conversations.map(async (conversation)=>{
            // console.log(conversation.members);
            // now we will fetch and send the details of other person i.e. if our user is sender then receivers else sender's
            const receiverId=conversation.members[1]===userId?conversation.members[0]:conversation.members[1];
            console.log(receiverId);
            const userd= await User.findById(receiverId);   
            console.log("Sending the conversation details");
            // console.log(await userd);
            return {
                user:{
                    receiverId:userd?._id,
                    email:userd?.email,
                    fullName:userd?.fullName
                },
                conversationId:conversation._id
            }
        }));
        return res.status(200).json(await conversationUserData);
    }catch(err){
        console.log("error",err);
        return res.send("Error");
    }
});


app.post('/api/image',upload.single("file"),async(req,res)=>{
    try{
        const {conversationId,senderId,receiverId}=req.body;
        const {file}=req;
        if(!senderId){
            return res.status(400).send("All fields are required");
        }
        const newMessage=new Message({
            conversationId:conversationId,
            senderId:senderId,
            message:`/uploads/${file.filename}`,
            isImage:true,
        });
        await newMessage.save();
        res.status(200).json({
            message: 'File uploaded successfully',
            imageUrl: `/uploads/${file.filename}`
          });
          res.send();
    }catch(error){
        console.log(error);
        return res.status(500).send("Error")
    }
})

app.post('/api/message',async (req,res)=>{
    try{
        console.log("body",req.body);
        const {conversationId,senderId,message,receiverId}=req.body;
        
        if(!senderId || !message){
            return res.status(400).send("All fields are required");
        }
        if(conversationId=="new" && receiverId){
            const newConversation=new Conversation({members:[senderId,receiverId]});
            await newConversation.save();
            const newMessage=new Message({
                conversationId:newConversation._id,
                senderId:senderId,
                message:message,
                isImage:false,
            });
            await newMessage.save();
            console.log("I am heree with conversationId new");
            return res.status(200).json({
                message:"Message sent successfully",
                conversationId:newConversation._id
            });
        }else if(!conversationId && receiverId=="" ){
            return res.status(400).send("Please Send all required Details");
        }
        // console.log("asijdfsoi");
        const newMessage=new Message({
            conversationId:conversationId,
            senderId:senderId,
            message:message,
            isImage:false,
        });

        // console.log(1234,newMessage)
        newMessage.save();
        return res.status(200).json({message:"Message sent successfully"});
    }catch(error){
        return res.status(500).send("Error");
    }
});

app.get("/api/message/:conversationId",async (req,res)=>{
    try{

        const checkMessages=async (conversationId)=>{
            console.log("conversationId",conversationId);
            const messages=await Message.find({conversationId});
            // .sort({createdAt:-1})
            // .skip(page*limit)
            // .limit(limit);
            console.log("messages"+messages);
            const messageUserdata=Promise.all(messages.map(async (message)=>{
                const sender=await User.findById(message.senderId);
                // console.log(sender);
                return {
                    user:{
                        id:sender._id,
                        email:sender.email,
                        fullName:sender.fullName
                    },
                    message:message.message,
                    isImage:message.isImage,
                    createdAt:message.createdAt,
                }
            }));
            const userd=await messageUserdata;
            userd.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            console.log(userd);
            console.log("Sending the messages");
            return res.status(200).json(userd);
        }

        const conversationId=req.params.conversationId;
        // const {page,limit}=req.query;
        if(conversationId==="new"){
            console.log("I am here inside new");
            return res.status(200).json([]);
        }
        return checkMessages(conversationId);
        
        
    }catch(err){
        console.log(err);
        return res.send("error in server");
    }
});

app.get("/api/groupMessage",async (req,res)=>{  
    // const group=Groups.find({_id:req.query.groupId});

    const conversations=await Conversation.find({members:{
        $in:[req.query.groupId]
    }});

    console.log("conversations",conversations);

    let allMessages=[]

    console.log("conversations",conversations); 
    for(const conversation of conversations){
        console.log("conversation",conversation);
        const messages=await Message.find({conversationId:conversation._id});
        console.log("messages",messages);
        const messageUserdata=await Promise.all(messages.map(async (message)=>{
            const sender=await User.findById(message.senderId);
            console.log("sender",sender);
            return {
                user:{
                    id:sender._id,
                    email:sender.email,
                    fullName:sender.fullName
                },
                message:message.message,
                isImage:message.isImage,
                createdAt:message.createdAt,
            }
        }));
        const data=await messageUserdata; 
        allMessages = [...allMessages,...data];
    }
    console.log("allMessages",allMessages);
    allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    console.log("allMessages",allMessages);
    // this will be all the messages of all conversations in a group
    res.json(allMessages);
});

app.get("/api/users",async (req,res)=>{
    try{
        const users=await User.find({});
        const usersData=Promise.all(users.map(async (user)=>{
            return {user:{email:user.email,fullName:user.fullName,receiverId:user._id}}
        }))
        return res.status(200).json(await usersData);
    }catch(err){
        console.log(err);
        return res.send("error in server");
    }
});

app.get('/download/uploads', (req, res) => {
    const file = __dirname +'/public/uploads/' + req.query.filename;
    res.download(file); // Set header to force download
});

app.get('/api/allGroups',async(req,res)=>{
    try{
        const groups=await Groups.find({});
        
        return res.status(200).json({"data":await groups});
    }catch(err){
        console.log(err);
        return res.send("error in server");
    }
})

app.get('/api/joinedGroups',async(req,res)=>{
    try{
        // console.log(1);
        // console.log("queery",req.query);
        const conversation=await Conversation.find({members:{
            $eq : [req.query.groupId,req.query.userId]
        } });
        // console.log(2);
        if(conversation.length>0){
            return res.status(200).json({"conversationId":conversation[0]?._id.toString()});
        }
        // console.log(3);
        const conversation1=await Conversation.find({members:{
            $eq : [req.query.userId,req.query.groupId]
        } });
        // console.log(conversation1,conversation);
        if(conversation1.length>0){
            
            return res.status(200).json({"conversationId":conversation1[0]._id.toString()});
        }
    }catch(err){
        console.log(err);
        return res.send("error in server");
    }
})

app.post('/api/addToGroup',async (req,res)=>{
    console.log(req.body);
    const grpid=req.body.groupId;
    const userid=req.body.userId;
    console.log(grpid);
    const group=await Groups.find({_id:grpid});
    if(group.length===0){
        return res.status(404).send("Group not found");
    }
    group[0].members.push(userid);
    group[0].save();

    const conversation=new Conversation({
        members:[grpid,userid]
    });
    conversation.save();

    console.log("conversation",conversation);
    console.log("conversationId",conversation._id);
    return res.status(200).json({"conversationId":conversation._id})
    
    
    // Groups.findByIdAndUpdate(grpid,{$push:{users:userid}},{new:true},(err,doc)=>{
    //     if(err){
    //         console.log(err);
    //         return res.status(500).send("Error");
    //     }
    //     Conversation.findOneAndUpdate({members:{
    //         $all:[userid,grpid]
    //     }},{$set:{members:[userid,grpid]}},{new:true},(err,doc1)=>{
    //         if(err){
    //             console.log(err);
    //             return res.status(500).send("Error");
    //         }
    //         return res.status(200).send("User added to group successfully");
    //     })
    // })

})

app.listen(port,()=>{
    console.log("Server Connected");
});