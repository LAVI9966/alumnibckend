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
});

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
});

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
});

// Middleware for populating user data when fetching a post
PostSchema.pre('findOne', function (next) {
  this.populate({
    path: 'user',
    select: 'name profilePicture'
  });
  next();
});

module.exports = mongoose.model("Post", PostSchema);