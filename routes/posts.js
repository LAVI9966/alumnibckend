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
const populateRepliesRecursively = async (replies, depth = 0, maxDepth = 10) => {
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
              }
            ]
          }
        ]
      });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Recursively populate all levels of nested replies
    if (post.comments && post.comments.length > 0) {
      for (const comment of post.comments) {
        if (comment.replies && comment.replies.length > 0) {
          await populateRepliesRecursively(comment.replies);
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
    } else {
      // Search for the target reply in all comments
      for (const comment of post.comments) {
        if (addReplyToTarget(comment.replies, targetId, newReply)) {
          targetFound = true;
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
    const updatedPost = await Post.findById(postId)
      .populate("user", "name profilePicture");

    // Populate the user data for all comments and replies
    if (updatedPost.comments) {
      for (const comment of updatedPost.comments) {
        await populateRepliesRecursively(comment.replies);
      }
    }

    // Find the newly added reply with populated user data
    let populatedReply = null;

    if (commentIndex !== -1) {
      // If we added to a comment, get the last reply
      const replies = updatedPost.comments[commentIndex].replies;
      populatedReply = replies[replies.length - 1];
    } else {
      // Otherwise search through all replies
      for (const comment of updatedPost.comments) {
        // Function to search for a reply by ID
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

// Delete a reply at any nesting level
router.delete("/:postId/reply/:replyId", auth, async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    const { path } = req.body; // Optional path parameter for precise targeting

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    let replyDeleted = false;

    // If path is provided, use it for precise targeting
    if (path) {
      const pathParts = path.split('.');
      let current = post;
      let parent = null;
      let index = null;
      let collection = null;

      // Navigate to the parent object that contains the reply
      for (let i = 0; i < pathParts.length - 2; i += 2) {
        if (pathParts[i + 1] === 'replies') {
          if (pathParts[i] === 'comments') {
            // Special case for comments array
            collection = current.comments;
          } else {
            const idx = parseInt(pathParts[i], 10);
            current = current[idx];
            collection = current.replies;
          }
        } else {
          const idx = parseInt(pathParts[i], 10);
          parent = current;
          current = current[pathParts[i + 1]][idx];
          collection = current;
        }
      }

      // Get the final index and remove the item
      const finalIndex = parseInt(pathParts[pathParts.length - 1], 10);

      // Check if this user is authorized to delete this reply
      if (collection[finalIndex].user.toString() !== req.user.id &&
        post.user.toString() !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this reply" });
      }

      collection.splice(finalIndex, 1);
      replyDeleted = true;
    } else {
      // Function to find and remove a reply at any nesting level
      const removeReply = (replies, parentReplies = null, parentIndex = null) => {
        if (!replies || !Array.isArray(replies)) return false;

        for (let i = 0; i < replies.length; i++) {
          if (replies[i]._id.toString() === replyId) {
            // Check authorization
            if (replies[i].user.toString() !== req.user.id &&
              post.user.toString() !== req.user.id) {
              return 'unauthorized';
            }

            // Remove the reply
            replies.splice(i, 1);
            return true;
          }

          // Check nested replies
          const result = removeReply(replies[i].replies, replies, i);
          if (result === true || result === 'unauthorized') {
            return result;
          }
        }

        return false;
      };

      // Look for the reply in all comments
      for (const comment of post.comments) {
        const result = removeReply(comment.replies);

        if (result === true) {
          replyDeleted = true;
          break;
        } else if (result === 'unauthorized') {
          return res.status(403).json({ message: "Not authorized to delete this reply" });
        }
      }
    }

    if (!replyDeleted) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // Save the post with the deleted reply
    await post.save();

    return res.status(200).json({ message: "Reply deleted successfully" });
  } catch (error) {
    console.error("Error deleting reply:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

module.exports = router;