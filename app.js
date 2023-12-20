const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mssql = require('mssql');
const dotenv = require('dotenv');

dotenv.config(); 

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(cookieParser());


const config = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    trustServerCertificate: true,
  },
};

const poolPromise = new mssql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log('Connected to SQL Server');
    return pool;
  })
  .catch((error) => {
    console.error('Database Connection Failed! Bad Config: ', error);
    throw error;
  });




  module.exports = {
    poolPromise,
  };


const userRoutes = require('./routes/userRoutes');
const leaveRoutes = require('./routes/leaveRoutes');




app.use('/user', userRoutes); 
app.use('/leave', leaveRoutes); 


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

