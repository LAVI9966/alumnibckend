// routes/posts.js
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const auth = require("../middleware/auth");


//  Create a new post (POST)
router.post("/", auth, async (req, res) => {
  try {
    const { content, imageUrl } = req.body;

    // Create the post
    const newPost = new Post({
      user: req.user.id, // user ID from the auth middleware
      content,
      imageUrl,
    });

    // Save the post to the database
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

// Get all posts (GET)
router.get("/", auth, async (req, res) => {
  try {
    // Retrieve all posts, populate user data if needed
    const posts = await Post.find()
      .populate("user", "name profilePicture") // choose fields to show
      .sort({ createdAt: -1 }); // newest first

    return res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
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

module.exports = router;
