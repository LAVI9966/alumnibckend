// routes/posts.js - Complete file with all features including working nested replies
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const multer = require("multer");
const path = require("path");
const adminVerify = require("../middleware/adminVerify");
const mongoose = require("mongoose");

// Configure multer storage for post images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads");
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Create a new post (POST) with image upload
router.post("/", auth, adminVerify, upload.single("image"), async (req, res) => {
  try {
    const { content } = req.body;
    // If an image file is uploaded, get its path
    const imageUrl = req.file ? req.file.path : undefined;

    // Create the post
    const newPost = new Post({
      user: req.user.id, // user ID from the auth middleware
      content,
      imageUrl,
    });

    await newPost.save();

    return res.status(201).json({
      message: "Post created successfully",
      post: newPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Admin Route: Create a new post with multiple image uploads
router.post('/admin', auth, admin, upload.array('images', 5), async (req, res) => {
  try {
    const { content } = req.body;
    // If images are uploaded, get an array of file paths
    const imagePaths = req.files ? req.files.map(file => file.path) : [];

    // Create the admin post with multiple images
    const newPost = new Post({
      user: req.user.id,
      content,
      images: imagePaths,
    });

    await newPost.save();

    return res.status(201).json({
      message: 'Admin post created successfully',
      post: newPost,
    });
  } catch (error) {
    console.error('Error creating admin post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts (GET)
router.get("/", auth, async (req, res) => {
  try {
    // Retrieve all posts with deep population
    const posts = await Post.find()
      .populate("user", "name profilePicture")
      .populate("likes", "name profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "likes", select: "name profilePicture" },
          {
            path: "replies",
            populate: [
              { path: "user", select: "name profilePicture" },
              { path: "likes", select: "name profilePicture" }
            ]
          }
        ]
      })
      .sort({ createdAt: -1 }); // newest first

    return res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get a single post by ID with deep population
router.get("/:id", auth, async (req, res) => {
  try {
    // Fetch the post with full population of all nested data
    const post = await Post.findById(req.params.id)
      .populate("user", "name profilePicture")
      .populate("likes", "name profilePicture")
      .populate("shares", "name profilePicture")
      .populate({
        path: "comments",
        populate: [
          {
            path: "user",
            select: "name profilePicture"
          },
          {
            path: "likes",
            select: "name profilePicture"
          },
          {
            path: "replies",
            populate: [
              {
                path: "user",
                select: "name profilePicture"
              },
              {
                path: "likes",
                select: "name profilePicture"
              }
            ]
          }
        ]
      });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // This manual population handles nested replies since Mongoose populate doesn't handle deep nesting well
    if (post.comments && post.comments.length > 0) {
      for (const comment of post.comments) {
        if (comment.replies && comment.replies.length > 0) {
          for (const reply of comment.replies) {
            if (reply.replies && reply.replies.length > 0) {
              // Find and populate user info for nested replies
              for (let i = 0; i < reply.replies.length; i++) {
                const nestedReply = reply.replies[i];
                if (nestedReply.user) {
                  try {
                    const user = await mongoose.model('User').findById(nestedReply.user)
                      .select('name profilePicture');
                    if (user) {
                      reply.replies[i].user = user;
                    }
                  } catch (err) {
                    console.error(`Error populating nested reply user: ${err.message}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    return res.status(200).json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

// GET posts for the currently authenticated user
router.get("/my-posts", auth, adminVerify, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user.id })
      .populate("user", "name profilePicture")
      .populate("likes", "name profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "name profilePicture" },
          { path: "likes", select: "name profilePicture" },
          {
            path: "replies",
            populate: [
              { path: "user", select: "name profilePicture" },
              { path: "likes", select: "name profilePicture" }
            ]
          }
        ]
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "User posts retrieved successfully",
      posts,
    });
  } catch (error) {
    console.error("Error retrieving user posts:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a post (PUT)
router.put("/:id", auth, adminVerify, upload.single("image"), async (req, res) => {
  try {
    const postId = req.params.id;
    const { content } = req.body;
    let updateData = {};

    // Update content if provided
    if (content) {
      updateData.content = content;
    }

    // Update image if a new file is uploaded
    if (req.file) {
      updateData.imageUrl = req.file.path;
    }

    // Update the post and return the updated document
    const updatedPost = await Post.findByIdAndUpdate(postId, updateData, { new: true });
    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a post
router.delete("/:id", auth, adminVerify, async (req, res) => {
  try {
    const postId = req.params.id;

    const deletedPost = await Post.findOneAndDelete({ _id: postId, user: req.user.id });
    if (!deletedPost) {
      return res.status(404).json({ message: "Post not found or not authorized" });
    }

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Like a post
router.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the post has already been liked by this user
    if (post.likes.some(like => like.toString() === req.user.id)) {
      // Remove like (unlike)
      post.likes = post.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Add like
      post.likes.push(req.user.id);
    }

    await post.save();

    return res.status(200).json({
      message: post.likes.some(like => like.toString() === req.user.id) ? "Post liked" : "Post unliked",
      likes: post.likes.length,
      isLiked: post.likes.some(like => like.toString() === req.user.id)
    });
  } catch (error) {
    console.error("Error liking/unliking post:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Share a post
router.post("/:id/share", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Add user to shares if not already there
    if (!post.shares.includes(req.user.id)) {
      post.shares.push(req.user.id);
      await post.save();
    }

    return res.status(200).json({
      message: "Post shared successfully",
      shares: post.shares.length
    });
  } catch (error) {
    console.error("Error sharing post:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Add a comment to a post
router.post("/:id/comment", auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const newComment = {
      user: req.user.id,
      text,
      likes: [],
      replies: []
    };

    post.comments.push(newComment);
    await post.save();

    // Populate user data in the new comment
    const populatedPost = await Post.findById(req.params.id)
      .populate({
        path: "comments",
        populate: { path: "user", select: "name profilePicture" }
      });

    const addedComment = populatedPost.comments[populatedPost.comments.length - 1];

    return res.status(201).json({
      message: "Comment added successfully",
      comment: addedComment
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Like a comment
router.post("/:postId/comment/:commentId/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if comment already liked by user
    if (comment.likes.some(like => like.toString() === req.user.id)) {
      // Unlike
      comment.likes = comment.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Like
      comment.likes.push(req.user.id);
    }

    await post.save();

    return res.status(200).json({
      message: comment.likes.some(like => like.toString() === req.user.id) ? "Comment liked" : "Comment unliked",
      likes: comment.likes.length,
      isLiked: comment.likes.some(like => like.toString() === req.user.id)
    });
  } catch (error) {
    console.error("Error liking/unliking comment:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Delete a comment
router.delete("/:postId/comment/:commentId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Find the comment
    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if user is authorized to delete comment (comment author or post author)
    if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized to delete this comment" });
    }

    // Remove the subdocument
    post.comments.pull({ _id: req.params.commentId });
    await post.save();

    return res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Add a reply to a comment
router.post("/:postId/comment/:commentId/reply", auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const newReply = {
      user: req.user.id,
      text,
      likes: [],
      replies: [] // Initialize empty replies array for nested replies
    };

    comment.replies.push(newReply);
    await post.save();

    // Populate user data in the new reply
    const populatedPost = await Post.findById(req.params.postId)
      .populate({
        path: "comments.replies.user",
        select: "name profilePicture"
      });

    const updatedComment = populatedPost.comments.id(req.params.commentId);
    const addedReply = updatedComment.replies[updatedComment.replies.length - 1];

    return res.status(201).json({
      message: "Reply added successfully",
      reply: addedReply
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Like a reply
router.post("/:postId/comment/:commentId/reply/:replyId/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const reply = comment.replies.id(req.params.replyId);

    if (!reply) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // Check if reply already liked by user
    if (reply.likes.some(like => like.toString() === req.user.id)) {
      // Unlike
      reply.likes = reply.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Like
      reply.likes.push(req.user.id);
    }

    await post.save();

    return res.status(200).json({
      message: reply.likes.some(like => like.toString() === req.user.id) ? "Reply liked" : "Reply unliked",
      likes: reply.likes.length,
      isLiked: reply.likes.some(like => like.toString() === req.user.id)
    });
  } catch (error) {
    console.error("Error liking/unliking reply:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Delete a reply
router.delete("/:postId/comment/:commentId/reply/:replyId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const reply = comment.replies.id(req.params.replyId);

    if (!reply) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // Check if user is authorized to delete reply (reply author, comment author, or post author)
    if (reply.user.toString() !== req.user.id &&
      comment.user.toString() !== req.user.id &&
      post.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized to delete this reply" });
    }

    // Remove the subdocument
    comment.replies.pull({ _id: req.params.replyId });
    await post.save();

    return res.status(200).json({ message: "Reply deleted successfully" });
  } catch (error) {
    console.error("Error deleting reply:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Add a nested reply to a reply
router.post("/:postId/comment/:commentId/reply/:replyId/reply", auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const parentReply = comment.replies.id(req.params.replyId);
    if (!parentReply) {
      return res.status(404).json({ message: "Parent reply not found" });
    }

    // Initialize replies array if it doesn't exist
    if (!parentReply.replies) {
      parentReply.replies = [];
    }

    // Create new nested reply with explicit ObjectId
    const newReply = {
      _id: new mongoose.Types.ObjectId(),
      user: req.user.id,
      text,
      likes: [],
      createdAt: new Date()
    };

    // Add the new reply to the parent reply's replies array
    parentReply.replies.push(newReply);

    // Save the post
    await post.save();

    // Populate user data in the new reply
    const populatedPost = await Post.findById(req.params.postId)
      .populate("user", "name profilePicture")
      .populate({
        path: "comments.replies.replies.user",
        select: "name profilePicture"
      });

    const updatedComment = populatedPost.comments.id(req.params.commentId);
    const updatedParentReply = updatedComment.replies.id(req.params.replyId);

    // Get the newly added reply
    const addedReply = updatedParentReply.replies[updatedParentReply.replies.length - 1];

    return res.status(201).json({
      message: "Reply added successfully",
      reply: addedReply
    });
  } catch (error) {
    console.error("Error adding nested reply:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: error.stack
    });
  }
});

// Delete a nested reply
router.delete("/:postId/comment/:commentId/reply/:replyId/reply/:nestedReplyId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const parentReply = comment.replies.id(req.params.replyId);
    if (!parentReply) {
      return res.status(404).json({ message: "Parent reply not found" });
    }

    // Check if replies array exists
    if (!parentReply.replies || !Array.isArray(parentReply.replies)) {
      return res.status(404).json({ message: "No nested replies found" });
    }

    // Find the nested reply
    const nestedReplyIndex = parentReply.replies.findIndex(
      reply => reply._id.toString() === req.params.nestedReplyId
    );

    if (nestedReplyIndex === -1) {
      return res.status(404).json({ message: "Nested reply not found" });
    }

    // Check authorization - user must be creator of the reply or parent entities
    const nestedReply = parentReply.replies[nestedReplyIndex];
    const nestedReplyUser = nestedReply.user.toString();

    if (nestedReplyUser !== req.user.id &&
      parentReply.user.toString() !== req.user.id &&
      comment.user.toString() !== req.user.id &&
      post.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized to delete this reply" });
    }

    // Remove the nested reply from the array
    parentReply.replies.splice(nestedReplyIndex, 1);

    // Save the post
    await post.save();

    return res.status(200).json({ message: "Reply deleted successfully" });
  } catch (error) {
    console.error("Error deleting nested reply:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;