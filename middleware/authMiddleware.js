const jwt = require('jsonwebtoken')
const { createClient } = require('redis')

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


  const whiteListed = async (req, res, next) => {

    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return res.status(403).send('Access Denied');
    }

    const user = jwt.decode(token);
    const client = createClient()


    try {
      await client.connect();
      
      if (user === null) {
        return res.status(403).send('Token is Invalid / Not Working')
      }

      const isWhiteListed = await client.get("HRLeaveApp__" + user.EmployeeCode)
      if (isWhiteListed !== token) {
        return res.status(403).send('Token is Not White Listed');
      }
      req.user = user;
      next();
    } catch (error) {
      console.log(error)
    }
  };


module.exports = {
  isAdmin,
  whiteListed,
};