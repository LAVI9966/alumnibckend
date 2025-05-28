// routes/posts.js - Enhanced for true infinite nesting of replies
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User"); // Add User model
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const multer = require("multer");
const path = require("path");
const adminVerify = require("../middleware/adminVerify");
const mongoose = require("mongoose");
const fs = require("fs");
// Configure multer storage for post images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create a more unique filename with original extension
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    cb(null, fileName);
  },
});


// File filter to ensure only images are uploaded
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 10MB max file size
    files: 30 // Allow up to 30 images
  }
});


// Create a new post (POST) with multiple image upload - increased limit to 30
router.post("/", auth, adminVerify, upload.array("images", 30), async (req, res) => {
  try {
    const { content } = req.body;

    // Check if files were uploaded
    const images = req.files && req.files.length > 0
      ? req.files.map(file => file.path)
      : undefined;

    // Create the post with either multiple images
    const newPost = new Post({
      user: req.user.id,
      content,
      ...(images ? { images } : {})
    });

    await newPost.save();

    return res.status(201).json({
      message: "Post created successfully",
      post: newPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);

    // Provide more detailed error message for client
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
      } else if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: "Too many files. Maximum is 30 images." });
      } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: "Unexpected field name. Use 'images' for uploading files." });
      }
    }

    return res.status(500).json({ message: "Server error", error: error.message });
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
              { path: "likes", select: "name profilePicture" },
              // Add deeper population for nested replies
              {
                path: "replies",
                populate: [
                  { path: "user", select: "name profilePicture" },
                  { path: "likes", select: "name profilePicture" }
                ]
              }
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

// Recursive function to populate nested replies
const populateRepliesRecursively = async (replies, depth = 0, maxDepth = 20) => {
  if (!Array.isArray(replies) || replies.length === 0 || depth >= maxDepth) {
    return;
  }

  for (let i = 0; i < replies.length; i++) {
    // Populate user data if it's not already populated
    if (replies[i].user && typeof replies[i].user !== 'object') {
      try {
        const user = await User.findById(replies[i].user).select('name profilePicture');
        if (user) {
          replies[i].user = user;
        }
      } catch (err) {
        console.error(`Error populating user at depth ${depth}:`, err);
      }
    }

    // Populate likes data if it's not already populated
    if (replies[i].likes && replies[i].likes.length > 0) {
      for (let j = 0; j < replies[i].likes.length; j++) {
        if (typeof replies[i].likes[j] !== 'object') {
          try {
            const user = await User.findById(replies[i].likes[j]).select('name profilePicture');
            if (user) {
              replies[i].likes[j] = user;
            }
          } catch (err) {
            console.error(`Error populating like at depth ${depth}:`, err);
          }
        }
      }
    }

    // Recursively populate nested replies
    if (replies[i].replies && replies[i].replies.length > 0) {
      await populateRepliesRecursively(replies[i].replies, depth + 1, maxDepth);
    }
  }
};

// Get a single post by ID with deep population
router.get("/:id", auth, async (req, res) => {
  try {
    // Basic fetch with standard population
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
              }
            ]
          }
        ]
      });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Use the new populateUserData method to ensure all user data is populated
    await post.populateUserData();

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

// Update a post (PUT) with image deletion support
router.put("/:id", auth, upload.array("images", 30), async (req, res) => {
  try {
    const postId = req.params.id;
    const { content, imagesToKeep } = req.body;

    console.log("UPDATE REQUEST:", {
      postId,
      userId: req.user.id,
      hasContent: !!content,
      hasFiles: !!(req.files && req.files.length),
      imagesToKeep: imagesToKeep
    });

    // Find the original post
    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      console.log("Post not found:", postId);
      return res.status(404).json({ message: "Post not found" });
    }

    // Extract user ID properly regardless of whether it's populated or not
    const postUserId = originalPost.user && originalPost.user._id
      ? originalPost.user._id.toString()
      : originalPost.user.toString();

    console.log("Auth check:", {
      postUserId,
      requestUserId: req.user.id,
      isMatch: postUserId === req.user.id
    });

    // Proper authorization check
    if (postUserId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    // Build update data object
    const updateData = {};

    // Always update content if provided
    if (content !== undefined) {
      updateData.content = content;
    }

    // Handle images - now supporting partial updates
    // Parse the imagesToKeep JSON string if it exists
    let imagesToKeepArray = [];
    if (imagesToKeep) {
      try {
        imagesToKeepArray = JSON.parse(imagesToKeep);
        console.log("Images to keep:", imagesToKeepArray);
      } catch (e) {
        console.error("Error parsing imagesToKeep:", e);
      }
    }

    if (req.files && req.files.length > 0) {
      // If new files uploaded, combine with kept images
      updateData.images = [
        ...imagesToKeepArray,
        ...req.files.map(file => file.path)
      ];
      console.log("Updating with combined images:", updateData.images.length);
    } else if (imagesToKeep) {
      // If only keeping some existing images without adding new ones
      updateData.images = imagesToKeepArray;
      console.log("Updating with filtered images:", updateData.images.length);
    }

    // Clear imageUrl if we're using images array
    if (updateData.images && originalPost.imageUrl) {
      updateData.imageUrl = undefined;
    }

    console.log("Update data:", updateData);

    // Update post with new data
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      updateData,
      { new: true }
    );

    console.log("Post updated successfully");

    return res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost
    });
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({
      message: "Server error during update",
      error: error.message
    });
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
    const Notification = require("../models/Notification");
    let liked = false;
    // Check if the post has already been liked by this user
    if (post.likes.some(like => like.toString() === req.user.id)) {
      // Remove like (unlike)
      post.likes = post.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Add like
      post.likes.push(req.user.id);
      liked = true;
    }
    await post.save();
    // Only create notification if liked and not by self
    if (liked && post.user.toString() !== req.user.id) {
      await Notification.create({
        user: post.user,
        type: "like",
        post: post._id,
        fromUser: req.user.id,
        message: "liked your post"
      });
    }
    return res.status(200).json({
      message: liked ? "Post liked" : "Post unliked",
      likes: post.likes.length,
      isLiked: liked
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
    const Notification = require("../models/Notification");
    const newComment = {
      user: req.user.id,
      text,
      likes: [],
      replies: []
    };
    post.comments.push(newComment);
    await post.save();
    // Notify post owner if not commenting on own post
    if (post.user.toString() !== req.user.id) {
      await Notification.create({
        user: post.user,
        type: "comment",
        post: post._id,
        fromUser: req.user.id,
        message: "commented on your post"
      });
    }
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

// ENHANCED API FOR INFINITE REPLIES

// Helper function to find a reply at any nesting level by its ID
const findReplyById = (items, replyId, path = '', parentPath = '') => {
  if (!items || !Array.isArray(items)) return null;

  for (let i = 0; i < items.length; i++) {
    const currentPath = parentPath ? `${parentPath}.replies.${i}` : `${i}`;

    if (items[i]._id.toString() === replyId) {
      return {
        reply: items[i],
        index: i,
        path: currentPath
      };
    }

    // Check nested replies
    const result = findReplyById(items[i].replies, replyId, path, currentPath);
    if (result) {
      return result;
    }
  }

  return null;
};

// Helper function to add a reply to a target at any nesting level
const addReplyToTarget = (items, targetId, newReply) => {
  if (!items || !Array.isArray(items)) return false;

  for (let i = 0; i < items.length; i++) {
    if (items[i]._id.toString() === targetId) {
      // Initialize replies array if needed
      if (!items[i].replies) {
        items[i].replies = [];
      }
      // Add the reply
      items[i].replies.push(newReply);
      return true;
    }

    // Try adding to nested replies
    if (addReplyToTarget(items[i].replies, targetId, newReply)) {
      return true;
    }
  }

  return false;
};

// Generic Add Reply API route for any nesting level
router.post("/:postId/reply/:targetId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    const { postId, targetId } = req.params;
    if (!text) {
      return res.status(400).json({ message: "Reply text is required" });
    }
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    const Notification = require("../models/Notification");
    // Create a new reply object with MongoDB ObjectId
    const newReply = {
      _id: new mongoose.Types.ObjectId(),
      user: req.user.id,
      text,
      likes: [],
      replies: [],
      createdAt: new Date()
    };
    let targetFound = false;
    // First check if targetId is a comment ID
    const commentIndex = post.comments.findIndex(comment => comment._id.toString() === targetId);
    if (commentIndex !== -1) {
      // Add reply to this comment
      post.comments[commentIndex].replies.push(newReply);
      targetFound = true;
      // Notify comment owner if not replying to self
      const comment = post.comments[commentIndex];
      if (comment.user.toString() !== req.user.id) {
        await Notification.create({
          user: comment.user,
          type: "reply",
          post: post._id,
          fromUser: req.user.id,
          message: "replied to your comment"
        });
      }
    } else {
      // Search for the target reply in all comments
      for (const comment of post.comments) {
        if (addReplyToTarget(comment.replies, targetId, newReply)) {
          targetFound = true;
          // Find the target reply's owner
          const findReplyOwner = (replies, id) => {
            for (const reply of replies) {
              if (reply._id.toString() === id) return reply.user;
              if (reply.replies && reply.replies.length > 0) {
                const owner = findReplyOwner(reply.replies, id);
                if (owner) return owner;
              }
            }
            return null;
          };
          const replyOwner = findReplyOwner(comment.replies, targetId);
          if (replyOwner && replyOwner.toString() !== req.user.id) {
            await Notification.create({
              user: replyOwner,
              type: "reply",
              post: post._id,
              fromUser: req.user.id,
              message: "replied to your comment"
            });
          }
          break;
        }
      }
    }
    if (!targetFound) {
      return res.status(404).json({ message: "Target not found" });
    }
    // Save the post with the new reply
    await post.save();
    // Fetch the updated post with user data populated
    const updatedPost = await Post.findById(postId);
    await updatedPost.populateUserData();
    // Find the newly added reply with populated user data
    let populatedReply = null;
    if (commentIndex !== -1) {
      // If we added to a comment, get the last reply
      const replies = updatedPost.comments[commentIndex].replies;
      populatedReply = replies[replies.length - 1];
    } else {
      // Otherwise search through all replies
      for (const comment of updatedPost.comments) {
        const findReplyById = (replies, id) => {
          if (!replies || !Array.isArray(replies)) return null;
          for (const reply of replies) {
            if (reply._id.toString() === id.toString()) {
              return reply;
            }
            const nestedResult = findReplyById(reply.replies, id);
            if (nestedResult) return nestedResult;
          }
          return null;
        };
        const found = findReplyById(comment.replies, newReply._id);
        if (found) {
          populatedReply = found;
          break;
        }
      }
    }
    return res.status(201).json({
      message: "Reply added successfully",
      reply: populatedReply || newReply  // Fall back to unpopulated version if not found
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

// Like a reply at any nesting level
router.post("/:postId/reply/:replyId/like", auth, async (req, res) => {
  try {
    const { postId, replyId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    let replyFound = false;
    let isLiked = false;
    let likesCount = 0;

    // Function to toggle like on a reply at any nesting level
    const toggleLike = (replies) => {
      if (!replies || !Array.isArray(replies)) return false;

      for (let i = 0; i < replies.length; i++) {
        if (replies[i]._id.toString() === replyId) {
          // Check if already liked
          const likeIndex = replies[i].likes.findIndex(like => like.toString() === req.user.id);

          if (likeIndex !== -1) {
            // Unlike
            replies[i].likes.splice(likeIndex, 1);
            isLiked = false;
          } else {
            // Like
            replies[i].likes.push(req.user.id);
            isLiked = true;
          }

          likesCount = replies[i].likes.length;
          return true;
        }

        // Check nested replies
        if (toggleLike(replies[i].replies)) {
          return true;
        }
      }

      return false;
    };

    // Check all comments for the reply
    for (const comment of post.comments) {
      if (toggleLike(comment.replies)) {
        replyFound = true;
        break;
      }
    }

    if (!replyFound) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // Save the post with the updated likes
    await post.save();

    return res.status(200).json({
      message: isLiked ? "Reply liked" : "Reply unliked",
      likes: likesCount,
      isLiked: isLiked
    });
  } catch (error) {
    console.error("Error liking/unliking reply:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

// Helper function to find and delete a reply at any nesting level
const findAndDeleteReply = (replies, replyId, path) => {
  for (let i = 0; i < replies.length; i++) {
    if (replies[i]._id.toString() === replyId) {
      replies.splice(i, 1);
      return true;
    }
    if (replies[i].replies && replies[i].replies.length > 0) {
      if (findAndDeleteReply(replies[i].replies, replyId, path)) {
        return true;
      }
    }
  }
  return false;
};

// Delete a reply
router.delete("/posts/:postId/replies/:replyId", async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    const { path, userId } = req.body;

    if (!path || !userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Find the comment that contains the reply
    const comment = post.comments.id(path[0]);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // If it's a direct reply to the comment
    if (path.length === 1) {
      const replyIndex = comment.replies.findIndex(
        (r) => r._id.toString() === replyId
      );
      if (replyIndex === -1) {
        return res.status(404).json({ message: "Reply not found" });
      }

      // Check if user is authorized to delete
      if (
        comment.replies[replyIndex].user.toString() !== userId &&
        post.user.toString() !== userId
      ) {
        return res.status(403).json({ message: "Not authorized to delete this reply" });
      }

      comment.replies.splice(replyIndex, 1);
    } else {
      // For nested replies, use the recursive function
      const success = findAndDeleteReply(comment.replies, replyId, path);
      if (!success) {
        return res.status(404).json({ message: "Reply not found" });
      }
    }

    await post.save();

    // Fetch the updated post with populated user data
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture")
      .populate({
        path: "comments.user",
        select: "name profilePicture",
      })
      .populate({
        path: "comments.replies.user",
        select: "name profilePicture",
      })
      .populate({
        path: "comments.replies.replies",
        populate: {
          path: "user",
          select: "name profilePicture",
        },
      });

    res.json(updatedPost);
  } catch (error) {
    console.error("Error deleting reply:", error);
    res.status(500).json({ message: "Error deleting reply", error: error.message });
  }
});
// Enhanced recursive reply deletion for posts.js route file

// Add this improved route to your posts.js file

// Helper function to find and delete a reply at any nesting level
const findAndDeleteReplyRecursive = (items, replyId, userId, postUserId) => {
  if (!items || !Array.isArray(items)) return false;

  for (let i = 0; i < items.length; i++) {
    if (items[i]._id.toString() === replyId) {
      // Check if the user is authorized to delete this reply
      if (items[i].user.toString() === userId || postUserId === userId) {
        // Remove the reply
        items.splice(i, 1);
        return true;
      } else {
        return { error: "Not authorized to delete this reply" };
      }
    }

    // Recursively check nested replies
    if (items[i].replies && items[i].replies.length > 0) {
      const result = findAndDeleteReplyRecursive(items[i].replies, replyId, userId, postUserId);
      if (result === true || result.error) {
        return result;
      }
    }
  }

  return false;
};

// Improved delete reply route that handles any nesting level
router.delete("/:postId/reply/:replyId", auth, async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    const userId = req.user.id;

    console.log(`Deleting reply: ${replyId} from post: ${postId} by user: ${userId}`);

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // First check if the replyId is directly in any comment's replies
    let replyDeleted = false;
    let authError = null;

    // Check in each comment's replies
    for (const comment of post.comments) {
      if (comment.replies) {
        const result = findAndDeleteReplyRecursive(comment.replies, replyId, userId, post.user.toString());
        if (result === true) {
          replyDeleted = true;
          break;
        } else if (result && result.error) {
          authError = result.error;
          break;
        }
      }
    }

    if (authError) {
      return res.status(403).json({ message: authError });
    }

    if (!replyDeleted) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // Save the post with the deleted reply
    await post.save();

    return res.status(200).json({
      message: "Reply deleted successfully",
      success: true
    });
  } catch (error) {
    console.error("Error deleting reply:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false
    });
  }
});
module.exports = router;