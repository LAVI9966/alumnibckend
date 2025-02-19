// routes/about.js
const express = require('express');
const router = express.Router();

// Return static content or fetch from DB
router.get('/', (req, res) => {
  res.json({
    title: 'About Rimcollian Alumni Portal',
    content:
      'A space for Rimcollians to stay connected and engaged. This portal helps keep the bond alive!',
  });
});

module.exports = router;