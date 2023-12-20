const mssql = require('mssql')
const express = require('express')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const dotenv = require('dotenv')
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt')

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = 'your_hardcoded_jwt_secret';
const tokenBlacklist = new Set();

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
    useUTC: true,
  }

}

const poolPromise = new mssql.ConnectionPool(config)
.connect()
.then((pool) => {
  console.log('Connected To Database');

  return pool;
})
.catch((error) => {
  console.error('Database Connection Failed:', error);
  throw (error);
});


//verifying token 
function verifyToken(req, res, next) {

  const token = req.header('authorization')?.split(' ')[1];

  if (!token) {
    return res.status(403).send('Access denied.');
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).send('Token expired or invalid.');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send('Invalid token.');
    }
    req.user = user;
    next();
  });
}


//checking user if admin
function isAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).send('Access denied. Admin privileges required.');
  }
}


//register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await poolPromise;

    const checkUserQuery = `SELECT * FROM Users WHERE Username = '${username}'`;
    const checkUserResult = await pool.request().query(checkUserQuery);
    const existingUser = checkUserResult.recordset[0];

    if (existingUser) {
      return res.status(400).send('Username is already taken.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertUserQuery = `INSERT INTO Users (Username, Password) VALUES ('${username}', '${hashedPassword}')`;
    const insertResult = await pool.request().query(insertUserQuery);

    if (insertResult.rowsAffected[0] === 1) {
      res.status(201).send('User registered successfully!');
    } else {
      console.error('Error registering user.');
      res.status(500).send('Error registering user.');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering user.');
  }
});


//login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    const result = await request.query(`SELECT * FROM Users WHERE Username = '${username}'`);
    const user = result.recordset[0];

    if (!user) {
      return res.status(401).send('Invalid username or password.');
    }

    const passwordMatch = await bcrypt.compare(password, user.Password);

    if (passwordMatch) {

      const token = jwt.sign({ UserID: user.UserID, username: user.Username, isAdmin: user.isAdmin }, JWT_SECRET);
      res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
      res.status(200).json({ message: 'Login successful!', token });
    } else {
      res.status(401).send('Invalid username or password.');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error during login.');
  }
});


//logout route
app.post('/logout', verifyToken, (req, res) => {
  const token = req.header('authorization')?.split(' ')[1];

  if (token) {
    tokenBlacklist.add(token);
    res.status(200).send('Logout successful.');
  } else {
    res.status(400).send('Invalid request.');
  }
});




//add or application for leave of users
app.post('/leave-request', verifyToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const { LeaveType, Days, TimeFrom, TimeTo, DateFrom, DateTo } = req.body;
    const UserID = req.user.UserID;

    // Calculate the sum of 'Value' for the specific LeaveType
    const LeaveTypeSumQuery = await pool.request()
      .input('UserID', mssql.Int, UserID)
      .input('LeaveType', mssql.NVarChar, LeaveType)
      .query('SELECT SUM(Value) AS TotalValue FROM LeaveInfo WHERE UserID = @UserID AND LeaveType = @LeaveType');

    const totalValue = LeaveTypeSumQuery.recordset[0].TotalValue || 0; 

    if (Days > totalValue) {
      return res.status(400).json({ error: 'Insufficient balance for LeaveType' });
    } else {
      const currentYear = new Date().getFullYear();
      const remarks = `Filed${LeaveType}${currentYear}`;


      const formattedTimeFrom = TimeFrom.substring(0, 5);
      const formattedTimeTo = TimeTo.substring(0, 5);
  
      // Determine if it's AM or PM
      const hourFrom = parseInt(formattedTimeFrom.split(':')[0]);
      const hourTo = parseInt(formattedTimeTo.split(':')[0]);
      const amOrPmFrom = hourFrom >= 12 ? ' PM' : ' AM';
      const amOrPmTo = hourTo >= 12 ? ' PM' : ' AM';
  
      // Remove leading zero from the hour
      const formattedTimeFromFinal = (hourFrom % 12 || 12) + formattedTimeFrom.slice(2) + amOrPmFrom;
      const formattedTimeToFinal = (hourTo % 12 || 12) + formattedTimeTo.slice(2) + amOrPmTo;
  
      
      const leaveRequestQuery = `
        INSERT INTO LeaveInfo (UserID, LeaveType, Days, TransDate, ValueType, TimeFrom, TimeTo, DateFrom, DateTo, Remarks, Status)
        VALUES (@UserID, @LeaveType, @Days, GETDATE(), 'Debit', @TimeFrom, @TimeTo, @DateFrom, @DateTo, @Remarks, 'Pending')
      `;
      
      const leaveRequestResult = await pool
        .request()
        .input('UserID', mssql.Int, UserID)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .input('Days', mssql.Float, Days)
        .input('TimeFrom', mssql.NVarChar, formattedTimeFromFinal)
        .input('TimeTo', mssql.NVarChar, formattedTimeToFinal)
        .input('DateFrom', mssql.Date, DateFrom)
        .input('DateTo', mssql.Date, DateTo)
        .input('Remarks', mssql.NVarChar, remarks)
        .query(leaveRequestQuery);

      if (leaveRequestResult.rowsAffected[0] === 0) {
        return res.status(500).json({ error: 'Failed to insert leave request' });
      }

      return res.status(201).json({ message: 'Leave request created successfully' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to insert leave request' });
  }
});



//admin actions approve and reject
app.post('/leave-action', verifyToken, isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const UserID = req.user.UserID;
    const { status, LeaveID } = req.body;

    if (status === 'Approved' || status === 'Rejected') {
      const actionTime = new Date();
      let updateLeaveQuery = `
        UPDATE LeaveInfo
        SET Status = @Status,
            ApprovedBy = @UserID,
            ApproveDateTime = @ActionTime
      `;

      if (status === 'Rejected') {
        updateLeaveQuery = `
          UPDATE LeaveInfo
          SET Status = @Status,
              RejectBy = @UserID,
              RejectDateTime = @ActionTime
        `;
      }

      updateLeaveQuery += `
        WHERE LeaveID = @LeaveID
      `;

      const result = await pool
        .request()
        .input('Status', mssql.NVarChar, status)
        .input('UserID', mssql.Int, UserID)
        .input('ActionTime', mssql.DateTime, actionTime)
        .input('LeaveID', mssql.Int, LeaveID)
        .query(updateLeaveQuery);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Leave request not found' });
      }

      if (status === 'Approved') {
        const leaveInfoQuery = await pool
          .request()
          .input('LeaveID', mssql.Int, LeaveID)
          .query('SELECT Days, LeaveType, UserID FROM LeaveInfo WHERE LeaveID = @LeaveID');

        let daysRequested = leaveInfoQuery.recordset[0].Days;
        const LeaveType = leaveInfoQuery.recordset[0].LeaveType;
        const userID = leaveInfoQuery.recordset[0].UserID;

        // Query for the initial year
        const initialYearQuery = await pool
          .request()
          .input('LeaveType', mssql.NVarChar, LeaveType)
          .input('UserID', mssql.Int, userID)
          .query('SELECT MIN(YEAR(YearGain)) AS InitialYear FROM LeaveInfo WHERE LeaveType = @LeaveType AND UserID = @UserID');

        const initialYear = initialYearQuery.recordset[0].InitialYear;

        let year = initialYear;

        while (daysRequested > 0 && year <= new Date().getFullYear()) {
          const yearDataQuery = await pool
            .request()
            .input('Year', mssql.Int, year)
            .input('LeaveType', mssql.NVarChar, LeaveType)
            .input('UserID', mssql.Int, userID)
            .query('SELECT Value FROM LeaveInfo WHERE YEAR(YearGain) = @Year AND LeaveType = @LeaveType AND UserID = @UserID');

          const yearData = yearDataQuery.recordset[0];

          if (yearData && yearData.Value >= daysRequested) {


            
            await pool
              .request()
              .input('Value', mssql.Float, yearData.Value - daysRequested)
              .input('Year', mssql.Int, year)
              .input('LeaveType', mssql.NVarChar, LeaveType)
              .input('UserID', mssql.Int, userID)
              .query('UPDATE LeaveInfo SET Value = @Value WHERE YEAR(YearGain) = @Year AND LeaveType = @LeaveType AND UserID = @UserID');


            const yearAndLeaveType = `${LeaveType}-${year}`;
            await pool
              .request()
              .input('YearUsed', mssql.NVarChar, yearAndLeaveType)
              .input('LeaveID', mssql.Int, LeaveID)
              .query('UPDATE LeaveInfo SET YearUsed = @YearUsed WHERE LeaveID = @LeaveID');

            daysRequested = 0; 
            break;
          } else if (yearData) {
            daysRequested -= yearData.Value;
            await pool
              .request()
              .input('Value', mssql.Float, 0)
              .input('Year', mssql.Int, year)
              .input('LeaveType', mssql.NVarChar, LeaveType)
              .input('UserID', mssql.Int, userID)
              .query('UPDATE LeaveInfo SET Value = @Value WHERE YEAR(YearGain) = @Year AND LeaveType = @LeaveType AND UserID = @UserID');
          }

          year++;
        }
      }

      return res.status(200).json({ message: `Leave request ${status}d successfully` });
    } else {
      return res.status(400).json({ error: 'Invalid status. Use "Approved" or "Rejected".' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update leave request' });
  }
});



// Get pending leave requests
app.get('/pending-leaves', verifyToken, isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const { status } = req.params;

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const pendingLeavesQuery = `
      SELECT * FROM LeaveInfo
      WHERE Status = 'Pending'
    `;


    const leaveRequestsResult = await pool
      .request()
      .input('Status', mssql.NVarChar, status)
      .query(pendingLeavesQuery);

    const pendingLeavesResult = await pool.request().query(pendingLeavesQuery);

    return res.status(200).json(pendingLeavesResult.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to retrieve pending leave requests' });
  }
});



// Get approved leave
app.get('/approved-leave', verifyToken, isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const { status } = req.params;


    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const leaveRequestsQuery = `
      SELECT * FROM LeaveInfo
      WHERE Status = 'Approved'
    `;

    const leaveRequestsResult = await pool
      .request()
      .input('Status', mssql.NVarChar, status)
      .query(leaveRequestsQuery);

    return res.status(200).json(leaveRequestsResult.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to retrieve leave requests by status' });
  }
});



// Get rejected leave
app.get('/rejected-leave', verifyToken, isAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const { status } = req.params;

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const leaveRequestsQuery = `
      SELECT * FROM LeaveInfo
      WHERE Status = 'Rejected'
    `;

    const leaveRequestsResult = await pool
      .request()
      .input('Status', mssql.NVarChar, status)
      .query(leaveRequestsQuery);

    return res.status(200).json(leaveRequestsResult.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to retrieve leave requests by status' });
  }
});



//get leave details of specific logged in user
app.get('/leave-details', verifyToken, async (req, res) => {
  try {
    const UserID = req.user.UserID;

    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ error: 'Error Connecting to Database' });
    }

    const getLeaveQuery = `
      SELECT *
      FROM LeaveInfo
      WHERE UserID = @UserID
        AND TimeFrom IS NOT NULL
        AND TimeTo IS NOT NULL
        AND DateFrom IS NOT NULL
        AND DateTo IS NOT NULL
    `;

    const result = await pool
      .request()
      .input('UserID', mssql.Int, UserID)
      .query(getLeaveQuery);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No Leave Details Found for this User' });
    }

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



//edit leave request
app.put('/editleave-request/:leaveId', verifyToken, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { LeaveType, Days, TimeFrom, TimeTo, DateFrom, DateTo } = req.body;
    const UserID = req.user.UserID;

    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ error: 'Database connection error' });
    }



    const formattedTimeFrom = TimeFrom.substring(0, 5);
    const formattedTimeTo = TimeTo.substring(0, 5);

    // Determine if it's AM or PM
    const hourFrom = parseInt(formattedTimeFrom.split(':')[0]);
    const hourTo = parseInt(formattedTimeTo.split(':')[0]);
    const amOrPmFrom = hourFrom >= 12 ? ' PM' : ' AM';
    const amOrPmTo = hourTo >= 12 ? ' PM' : ' AM';

    // Remove leading zero from the hour
    const formattedTimeFromFinal = (hourFrom % 12 || 12) + formattedTimeFrom.slice(2) + amOrPmFrom;
    const formattedTimeToFinal = (hourTo % 12 || 12) + formattedTimeTo.slice(2) + amOrPmTo;


    const checkLeaveOwnershipQuery = `
      SELECT UserID
      FROM LeaveInfo
      WHERE LeaveID = @LeaveID;
    `;

    const checkLeaveOwnershipResult = await pool
      .request()
      .input('LeaveID', mssql.Int, leaveId)
      .query(checkLeaveOwnershipQuery);

    if (checkLeaveOwnershipResult.recordset.length === 0 || checkLeaveOwnershipResult.recordset[0].UserID !== UserID) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    // Update leave request
    const updateLeaveQuery = `
      UPDATE LeaveInfo
      SET Days = @Days,
          TimeFrom = @TimeFrom,
          TimeTo = @TimeTo,
          DateFrom = @DateFrom,
          DateTo = @DateTo,
          LeaveType = @LeaveType
      WHERE LeaveID = @LeaveID;
    `;

    const updateResult = await pool
      .request()
      .input('Days', mssql.Float, Days)
      .input('TimeFrom', mssql.NVarChar, formattedTimeFromFinal)
      .input('TimeTo', mssql.NVarChar, formattedTimeToFinal)
      .input('DateFrom', mssql.Date, DateFrom)
      .input('DateTo', mssql.Date, DateTo)
      .input('LeaveType', mssql.NVarChar, LeaveType)
      .input('LeaveID', mssql.Int, leaveId)
      .query(updateLeaveQuery);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Failed to update leave request' });
    }

    res.status(200).json({ message: 'Leave request updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Delete a leave request
app.delete('/delete-leave/:leaveId', verifyToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const leaveId = req.params.leaveId;

    const leaveInfoQuery = await pool
      .request()
      .input('LeaveID', mssql.Int, leaveId)
      .query('SELECT * FROM LeaveInfo WHERE LeaveID = @LeaveID');

    const leaveRequest = leaveInfoQuery.recordset[0];

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (req.user.UserID === leaveRequest.UserID || req.user.isAdmin) {
      const deleteQuery = `
        DELETE FROM LeaveInfo
        WHERE LeaveID = @LeaveID
      `;

      const deleteResult = await pool
        .request()
        .input('LeaveID', mssql.Int, leaveId)
        .query(deleteQuery);

      if (deleteResult.rowsAffected[0] === 0) {
        return res.status(500).json({ error: 'Failed to delete leave request' });
      }

      return res.status(200).json({ message: 'Leave request deleted successfully' });
    } else {
      return res.status(403).json({ error: 'Access denied. You are not authorized to delete this leave request' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete leave request' });
  }
});




// Get leave balance by year for a specific user
app.get('/leave-balance', verifyToken, async (req, res) => {
  try {
    const UserID = req.user.UserID;

    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ error: 'Error Connecting to Database' });
    }

    const leaveBalanceQuery = `
      SELECT YEAR(YearGain) AS Year, LeaveType, Value AS Balance
      FROM LeaveInfo
      WHERE UserID = @UserID AND YEAR(YearGain) IS NOT NULL AND Value IS NOT NULL
    `;

    const result = await pool
      .request()
      .input('UserID', mssql.Int, UserID)
      .query(leaveBalanceQuery);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No leave balance data found for this user' });
    }

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




const updateVLValue = async () => {
  try {
    const LeaveType = 'VL';
    const increment = 1.75;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    const pool = await poolPromise;

    // Update VL Value and Days for the current year in YearGain
    const updateVLQuery = `
      UPDATE LeaveInfo
      SET Value = Value + @Increment,
          Days = Days + @Increment
      WHERE LeaveType = @LeaveType
      AND YEAR(YearGain) = @CurrentYear
    `;

    const updateResult = await pool
      .request()
      .input('Increment', mssql.Float, increment)
      .input('LeaveType', mssql.NVarChar, LeaveType)
      .input('CurrentYear', mssql.Int, currentYear)
      .query(updateVLQuery);

    if (updateResult.rowsAffected[0] === 0) {
      console.log(`No VL record found for the current year (${currentYear}).`);
    } else {
      console.log('VL Value and Days updated successfully');
    }
  } catch (error) {
    console.error('Failed to update VL Value and Days:', error);
  }
};

const updateInterval1 = 30000;
setInterval(updateVLValue, updateInterval1);


// Function to initialize SL and EL to 21 and VL based on the previous year
async function initializeLeaveBalancesForNewYear() {
  try {
    const pool = await poolPromise;
    const currentYear = new Date().getFullYear();

    // Define leave types and their initial values
    const leaveTypes = [
      { type: 'SL', initialValue: 21, remarkPrefix: 'EarnedSL' },
      { type: 'EL', initialValue: 21, remarkPrefix: 'EarnedEL' },
      { type: 'VL', initialValue: 0, remarkPrefix: 'EarnedVL' },
    ];

    for (const leaveTypeData of leaveTypes) {
      const { type, initialValue, remarkPrefix } = leaveTypeData;

      const insertLeaveTypeQuery = `
        INSERT INTO LeaveInfo (UserID, LeaveType, Value, YearGain, TransDate, ValueType, Status, ApprovedBy, ApproveDateTime, Days, Remarks)
        SELECT UserID, @LeaveType, @InitialValue, @CurrentYear, GETDATE(), 'Credit', 'Approved', 'System', GETDATE(), @InitialValue, @RemarkPrefix + CAST(@CurrentYear AS VARCHAR)
        FROM Users;
      `;

      const result = await pool
        .request()
        .input('LeaveType', mssql.NVarChar, type)
        .input('InitialValue', mssql.Float, initialValue)
        .input('CurrentYear', mssql.Int, currentYear)
        .input('RemarkPrefix', mssql.NVarChar, remarkPrefix)
        .query(insertLeaveTypeQuery);

      console.log(`Initialized ${type} balance for the year ${currentYear} with an initial value of ${initialValue}`);
    }
  } catch (error) {
    console.error('Failed to initialize leave balances:', error);
  }
}

const updateInterval2 = 1500000;
setInterval(initializeLeaveBalancesForNewYear, updateInterval2);

// // Schedule the initialization function to run every 2 minutes
// setInterval(initializeLeaveBalancesForNewYear, 2 * 60 * 1000); // Run every 2 minutes

// // Call the initialization function when the server starts
// initializeLeaveBalancesForNewYear();


















app.listen(port, () => {
  console.log(`Server Porn is running in ${port}`);
})
