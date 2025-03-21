// routes/posts.js
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const multer = require("multer");
const path = require("path");
const adminVerify = require("../middleware/adminVerify");




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

module.exports = router;
