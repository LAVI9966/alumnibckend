// models/Post.js - Recursive Schema for Infinite Nested Replies
const mongoose = require("mongoose");

// Create a recursive schema that allows infinite nesting of replies
const ReplySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  }
}, { _id: true }); // Ensure _id is always generated

// Add the recursive replies field after schema initialization to avoid issues
ReplySchema.add({
  replies: [ReplySchema] // This is the key - a reply can contain replies of the same schema
});

// Comment Schema
const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  replies: [ReplySchema], // Array of replies that can have their own nested replies
  createdAt: {
    type: Date,
    default: Date.now,
  }
}, { _id: true }); // Ensure _id is always generated

// Post Schema
const PostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
  },
  images: {
    type: [String],
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  comments: [CommentSchema],
  shares: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  }
}, { _id: true }); // Ensure _id is always generated

// Middleware for populating user data when fetching a post
PostSchema.pre('findOne', function (next) {
  this.populate({
    path: 'user',
    select: 'name profilePicture'
  });
  next();
});

// Add middleware to populate user data for comments and replies
PostSchema.pre('find', function (next) {
  this.populate({
    path: 'user',
    select: 'name profilePicture'
  });
  next();
});

// Add a method to recursively populate user data
PostSchema.methods.populateUserData = async function () {
  const populateUser = async (item) => {
    if (!item) return;

    // Populate user data if it's an ObjectId
    if (item.user && typeof item.user === 'object' && !item.user.name) {
      const user = await mongoose.model('User').findById(item.user).select('name profilePicture');
      if (user) {
        item.user = user;
      }
    }

    // Populate likes
    if (item.likes && Array.isArray(item.likes)) {
      for (let i = 0; i < item.likes.length; i++) {
        if (typeof item.likes[i] === 'object' && !item.likes[i].name) {
          const user = await mongoose.model('User').findById(item.likes[i]).select('name profilePicture');
          if (user) {
            item.likes[i] = user;
          }
        }
      }
    }

    // Recursively populate replies
    if (item.replies && Array.isArray(item.replies)) {
      for (const reply of item.replies) {
        await populateUser(reply);
      }
    }
  };

  // Populate comments and their replies
  if (this.comments) {
    for (const comment of this.comments) {
      await populateUser(comment);
    }
  }
};

module.exports = mongoose.model("Post", PostSchema);