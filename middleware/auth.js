// middleware/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

module.exports = function (req, res, next) {
  // Expect header in the form: "Bearer <token>"
  const token = req.header('Authorization')?.split(' ')[1];
  // console.log(token);
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded,"decoded");
    req.user = decoded; // contains user id and role
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};