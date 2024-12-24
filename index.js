const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const app = express();

const quidaxBot = require('./quidax');

// Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res , next) => {
    res.json({
        message: 'Welcome to OJ\'s experiments'
    });
});
app.get('/quidax', async (req, res , next) => {
    await quidaxBot();
    res.json({
        message: 'Quidax Bot Started'
    });
});

// Error handler - simplified to just return JSON
app.use((err, req, res, next) => {
  const error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500).json({
    message: err.message,
    error: error
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app