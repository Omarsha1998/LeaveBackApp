const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");
const { createClient } = require("redis")
const JWT_SECRET = "secret";
const tokenBlacklist = new Set();

const UserController = {
  registerUser: async (req, res) => {
    const { username, password } = req.body;
    try {
      const message = await UserModel.registerUser(
        req.app.locals.conn,
        username,
        password
      );
      if (message === "User registered successfully!") {
        res.status(201).send(message);
      } else {
        res.status(400).send(message);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Error registering user.");
    }
  },

  loginUser: async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await UserModel.loginUser(
        req.app.locals.conn,
        username,
        password
      );
      if (typeof user === "object") {
        const token = jwt.sign(user, JWT_SECRET);
  
        try {
          const conn = createClient();
          
          await conn.connect();
          // Set the token in Redis with a key based on EmployeeCode
          await conn.set("HRLeaveApp__" + user.EmployeeCode, token);

        } catch (err) {
          console.log(err);
        }
  
        res.cookie("token", token, { httpsOnly: true, secure: true });
        res.status(200).json({ message: "Login successful!", token });
      } else {
        res.status(401).send(user);
      }
    } catch (error) {
      res.status(500).send("Error during login.");
    }
  },

  logoutUser: async (req, res) => {
    const token = req.header("authorization")?.split(" ")[1];
    
    
    if (token) {
      try {
        const conn = createClient();
        await conn.connect();
        // Set the token in Redis with a key based on EmployeeCode
        await conn.sendCommand(["DEL", "HRLeaveApp__" + req.user.EmployeeCode]);
      } catch (err) {
        console.log(err);
      }
      res.status(200).send("Logout successful.");
    } else {
      res.status(400).send("Invalid request.");
    }
  },
};

module.exports = UserController;
