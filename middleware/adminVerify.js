const User = require("../models/User");

const adminVerify = async (req, res, next) => {
  try {
    // Ensure the user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // // Optionally re-fetch the user from the database to get the latest verification status
    // const user = await User.findById(req.user._id);
    // if (!user) {
    //   return res.status(404).json({ message: "User not found" });
    // }

    // Check if the user is verified by admin
    if (user.status !== "verified") {
      return res.status(403).json({
        message:
          "User is not verified by admin. Please contact the administrator.",
      });
    }

    // User is verified; allow the request to proceed
    next();
  } catch (error) {
    console.error("Verification middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = adminVerify;
