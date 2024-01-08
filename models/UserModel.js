const bcrypt = require('bcrypt');
const { poolPromise } = require('../app');
const axios = require('axios');


const UserModel = {

  registerUser: async (conn, username, password) => {
    try {
      const request = conn.request();
      const checkUserQuery = `SELECT * FROM Users WHERE Username = '${username}'`;
      const checkUserResult = await request.query(checkUserQuery);
      const existingUser = checkUserResult.recordset[0];

      if (existingUser) {
        return 'Username is already taken.';
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertUserQuery = `INSERT INTO Users (Username, Password) VALUES ('${username}', '${hashedPassword}')`;
      const insertResult = await request.query(insertUserQuery);

      if (insertResult.rowsAffected[0] === 1) {
        return 'User registered successfully!';
      } else {
        return 'Error registering user.';
      }
    } catch (error) {
      throw error;
    }
  },

  // loginUser: async (username, password) => {
  //   try {
  //     const pool = await poolPromise;
  //     const request = pool.request();
  //     const result = await request.query(`SELECT * FROM Users WHERE Username = '${username}'`);
  //     const user = result.recordset[0];

  //     if (!user) {
  //       return 'Invalid username or password.';
  //     }


  //     const passwordMatch = await bcrypt.compare(password, user.Password);

  //     if (passwordMatch) {
  //       return { UserID: user.UserID, Name: user.Name, username: user.Username, isAdmin: user.isAdmin };
  //     } else {
  //       return 'Invalid username or password.';
  //     }
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // loginUser: async (employeeCode, password) => {
  //   try {
  //     const pool = await poolPromise;
  //     const request = pool.request();
  //     const result = await request.query(`SELECT * FROM Employee WHERE EmployeeCode = '${employeeCode}'`);
  //     const employee = result.recordset[0];
  
  //     if (!employee) {
  //       return 'Invalid employee code or password.';
  //     }
  
  //     // Bypass password check for testing purposes
  //     const isTestMode = true;
  //     if (isTestMode) {
  //       // Make a request to the access-right URL
  //       const accessRightResponse = await axios.get('http://10.107.0.10:3000/access-right', {
  //         params: {
  //           appName: 'Purchase Request',
  //           moduleName: 'Approver Item Request',
  //           code: employee.EmployeeCode
  //         }
  //       });
  
  //       // Check the access right response
  //       const isAccess = accessRightResponse.data[0]?.isAccess || false;
  //       const isAdmin = isAccess;
  
  //       return {
  //         Name: employee.LastName + ',' + ' ' + employee.FirstName + ' ' + employee.MiddleInitial + '.',
  //         EmployeeCode: employee.EmployeeCode,
  //         isAdmin: isAdmin
  //       };
  //     }
  
  //     // Check if the hashed password matches the stored hashed password
  //     const passwordMatch = await bcrypt.compare(password, employee.Password);
  
  //     if (passwordMatch) {
  //       // Make a request to the access-right URL
  //       const accessRightResponse = await axios.get('http://10.107.0.10:3000/access-right', {
  //         params: {
  //           appName: 'Purchase Request',
  //           moduleName: 'Approver Item Request',
  //           code: employee.EmployeeCode
  //         }
  //       });
  
  //       // Check the access right response
  //       const isAccess = accessRightResponse.data[0]?.isAccess || false;
  //       const isAdmin = isAccess;
  
  //       return {
  //         Name: employee.LastName + ',' + ' ' + employee.FirstName + ' ' + employee.MiddleInitial + '.',
  //         EmployeeCode: employee.EmployeeCode,
  //         isAdmin: isAdmin
  //       };
  //     } else {
  //       return 'Invalid employee code or password.';
  //     }
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  loginUser: async (conn, EmployeeCode, password) => {
    try {
      const request = conn.request();
      const result = await request.query(`SELECT * FROM Employee WHERE EmployeeCode = '${EmployeeCode}'`);
      const employee = result.recordset[0];
  
      if (!employee) {
        return 'Invalid employee code or password.';
      }
  
      // Bypass password check for testing purposes
      const isTestMode = true;
      if (isTestMode) {
        return {
          Name: employee.LastName + ',' + ' ' + employee.FirstName + ' ' + employee.MiddleInitial + '.',
          EmployeeCode: employee.EmployeeCode,
          Department: employee.DeptCode,
          isAdmin: true
        };
      }
  
      // Check if the hashed password matches the stored hashed password
      const passwordMatch = await bcrypt.compare(password, employee.Password);
  
      if (passwordMatch) {
        return {
          Name: employee.LastName + ',' + ' ' + employee.FirstName + ' ' + employee.MiddleInitial + '.',
          EmployeeCode: employee.EmployeeCode,
          isAdmin: true
        };
      } else {
        return 'Invalid employee code or password.';
      }
    } catch (error) {
      throw error;
    }
  },
  

  


};

module.exports = UserModel;
