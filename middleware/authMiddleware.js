const jwt = require('jsonwebtoken')

const JWT_SECRET = 'secret'
const tokenBlacklist = new Set()

  const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return res.status(403).send('Access Denied');
    }
    if (tokenBlacklist.has(token)) {
      return res.status(401).send('Token expired or invalied');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).send('Invalid Token');
      }
      req.user = user;
      next();
    });
  };


  const isAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
      next();
    } else {
      res.status(403).send('Access Denied, Admin Priveleges Required');
    }
  };

module.exports = {
  verifyToken,
  isAdmin,
};