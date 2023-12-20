const { poolPromise } = require('../app');
const mssql = require('mssql');
const trans = require('../utils/transactionDButils');



const LeaveRequestModel = {

  calculateTotalLeaveValue: async (EmployeeCode, LeaveType) => {
      const pool = await poolPromise;
    
      // Query to get remaining days from [UE database]..leaveledger
      const leaveLedgerQuery = `
          SELECT
              l.leaveType,
              Remaining = SUM(l.debit - l.credit)
          FROM
              [UE database]..leaveledger l
          WHERE
              l.YearEffectivity = YEAR(GETDATE())
              AND (l.Debit > 0 OR l.Credit > 0)
              AND l.code = @EmployeeCode
              AND l.leaveType = @LeaveType
          GROUP BY
              l.code,
              l.yearAttributed,
              l.leaveType
          ORDER BY
              l.Code;
      `;

      // Query to get remaining days from HR..LeaveInfo
      const leaveInfoQuery = `
          SELECT
              SUM(Days) AS Remaining
          FROM
              HR..LeaveInfo
          WHERE
              Code = @EmployeeCode
              AND LeaveType = @LeaveType
              AND STATUS = 'PENDING'
      `;
    
      // Execute the queries
      const leaveLedgerResult = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .query(leaveLedgerQuery);

      const leaveInfoResult = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .query(leaveInfoQuery);

      const leaveLedge = leaveLedgerResult.recordset[0].Remaining || 0;
      const leaveInfo = leaveInfoResult.recordset[0].Remaining || 0;


      return leaveLedge - leaveInfo;
  },



  calculateTotalLeaveValueInEdit: async (EmployeeCode, LeaveType, leaveId) => {
      const pool = await poolPromise;



      const leaveIDInforQuery = `
          SELECT
              SUM(Days) AS Remaining
          FROM
              HR..LeaveInfo
          WHERE
              Code = @EmployeeCode
              AND LeaveID = @LeaveID
              AND LeaveType = @LeaveType
              AND STATUS = 'PENDING'
      `;

      const leaveInfoQuery = `
          SELECT
              SUM(Days) AS Remaining
          FROM
              HR..LeaveInfo
          WHERE
              Code = @EmployeeCode
              AND LeaveType = @LeaveType
              AND STATUS = 'PENDING'
      `;

      // Query to get remaining days from [UE database]..leaveledger
      const leaveLedgerQuery = `
          SELECT
              l.leaveType,
              Remaining = SUM(l.debit - l.credit)
          FROM
              [UE database]..leaveledger l
          WHERE
              l.YearEffectivity = YEAR(GETDATE())
              AND (l.Debit > 0 OR l.Credit > 0)
              AND l.code = @EmployeeCode
              AND l.leaveType = @LeaveType
          GROUP BY
              l.code,
              l.yearAttributed,
              l.leaveType
          ORDER BY
              l.Code;
      `;

      // Query to get remaining days from HR..LeaveInfo
      const leaveIDInfoResult = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .input('LeaveID', mssql.Int, leaveId)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .query(leaveIDInforQuery);

      const leaveInfoResult = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .query(leaveInfoQuery);
      
      // Execution of the queries
      const leaveLedgerResult = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .query(leaveLedgerQuery);


      const leaveIDInfo = leaveIDInfoResult.recordset[0].Remaining || 0;
      const leaveInfo = leaveInfoResult.recordset[0].Remaining || 0;
      const leaveLedge = leaveLedgerResult.recordset[0].Remaining || 0;

      const totalResult = leaveLedge - leaveInfo + leaveIDInfo;

      return totalResult;
  },






  

  createLeaveRequest: async (EmployeeCode, LeaveType, Days, TimeFrom, TimeTo, DateFrom, DateTo, Reason) => {
    const pool = await poolPromise;

    const formattedTimeFrom = TimeFrom.substring(0, 5);
    const formattedTimeTo = TimeTo.substring(0, 5);

    const hourFrom = parseInt(formattedTimeFrom.split(':')[0]);
    const hourTo = parseInt(formattedTimeTo.split(':')[0]);
    const amOrPmFrom = hourFrom >= 12 ? ' PM' : ' AM';
    const amOrPmTo = hourTo >= 12 ? ' PM' : ' AM';
    const formattedTimeFromFinal = (hourFrom % 12 || 12) + formattedTimeFrom.slice(2) + amOrPmFrom;
    const formattedTimeToFinal = (hourTo % 12 || 12) + formattedTimeTo.slice(2) + amOrPmTo;

    const currentYear = new Date().getFullYear();
    const remarks = `FILED-${LeaveType}-${currentYear}`;

      const queryInsert = `
        DECLARE @LeaveID NVARCHAR(10)
        SET @LeaveID = CONVERT(NVARCHAR(4), YEAR(GETDATE())) + RIGHT('00' + CONVERT(NVARCHAR(2), (SELECT ISNULL(MAX(CAST(RIGHT(LeaveID, 2) AS INT)), 0) + 1 FROM HR..LeaveInfo)), 2)

        INSERT INTO HR..LeaveInfo (LeaveID, Code, LeaveType, Days, TransDate, YearEffectivity, YearAttributed, ItemType, TimeFrom, TimeTo, DateFrom, DateTo, Reason, Remarks, Status)
        OUTPUT INSERTED.LeaveID
        VALUES (@LeaveID, @EmployeeCode, @LeaveType, @Days, GETDATE(), YEAR(GETDATE()), YEAR(GETDATE()), 'FILED', @TimeFrom, @TimeTo, @DateFrom, @DateTo, @Reason, @Remarks, 'Pending')
      `;

      const result = await trans.runInTransaction(pool, async (request) => {
          const queryResult = await request
              .input('EmployeeCode', mssql.Int, EmployeeCode)
              .input('LeaveType', mssql.NVarChar, LeaveType)
              .input('Days', mssql.Float, Days)
              .input('TimeFrom', mssql.NVarChar, formattedTimeFromFinal)
              .input('TimeTo', mssql.NVarChar, formattedTimeToFinal)
              .input('DateFrom', mssql.Date, DateFrom)
              .input('DateTo', mssql.Date, DateTo)
              .input('Remarks', mssql.NVarChar, remarks)
              .input('Reason', mssql.NVarChar, Reason)
              .query(queryInsert);

          return queryResult;
      });

      return result.rowsAffected[0] > 0;
  },


  getLeaveDetails: async (EmployeeCode) => {
    try {
      const pool = await poolPromise;
  
      const getLeaveQuery = 
      `
      SELECT
          LeaveInfo.*,
          Employee.LastName,
          Employee.FirstName,
          Employee.MiddleInitial
      FROM
          HR..LeaveInfo
      JOIN
          [UE database]..Employee ON CONVERT(varchar(5), LeaveInfo.Code) = Employee.EmployeeCode
      WHERE
          LeaveInfo.Code = @EmployeeCode
          AND LeaveInfo.TimeFrom IS NOT NULL
          AND LeaveInfo.TimeTo IS NOT NULL
          AND LeaveInfo.DateFrom IS NOT NULL
          AND LeaveInfo.DateTo IS NOT NULL
      `;


  
      const result = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .query(getLeaveQuery);

      if (result.recordset.length === 0) {
        return { status: 404, message: 'No Leave Details Found for this User' };
      }
  
      return result.recordset;
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Failed to retrieve leave details' };
    }
  },



  // getLeaveBalance: async (EmployeeCode) => {
  //   try {
  //     const pool = await poolPromise;
  
  //     const leaveBalanceQuery = `
  //       SELECT YEAR(YearAttributed) AS Year, LeaveType, SUM(Debit) AS Balance
  //       FROM [UE database]..LeaveLedger
  //       WHERE Code = @EmployeeCode AND YEAR(YearAttributed) IS NOT NULL
  //       GROUP BY YEAR(YearAttributed), LeaveType
  //     `;
  
  //     const result = await pool
  //       .request()
  //       .input('EmployeeCode', mssql.Int, EmployeeCode)
  //       .query(leaveBalanceQuery);
  
  //     if (result.recordset.length === 0) {
  //       return { status: 404, message: 'No Leave Balance Found for this User' };
  //     }
  
  //     return result.recordset;
  //   } catch (error) {
  //     console.error(error);
  //     return { status: 500, message: 'Failed to retrieve leave balance' };
  //   }
  // },


  getLeaveBalance: async (EmployeeCode) => {
    try {
      const pool = await poolPromise;
  
      const leaveBalanceQuery = `
        SELECT 
          l.code,
          YEAR(l.YearAttributed) AS Year,
          l.leaveType,
          Remaining = SUM(l.Debit - l.Credit)
        FROM [UE database]..LeaveLedger l
        WHERE 
          l.Code = @EmployeeCode
          AND YEAR(l.YearAttributed) = YEAR(GETDATE())
          AND (l.Debit > 0 OR l.Credit > 0)
        GROUP BY 
          l.code,
          YEAR(l.YearAttributed),
          l.leaveType
        ORDER BY l.code, Year;
      `;
  
  
      const result = await pool
        .request()
        .input('EmployeeCode', mssql.Int, EmployeeCode)
        .query(leaveBalanceQuery);

  
      if (result.recordset.length === 0) {
        return { status: 404, message: 'No Leave Balance Found for this User' };
      }
  
      return result.recordset;
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Failed to retrieve leave balance' };
    }
  },



  getAllLeaveBalance: async () => {
    try {
      const pool = await poolPromise;
  
      const leaveBalanceQuery = `
      SELECT 
          l.code,
          YEAR(l.YearAttributed) AS Year,
          l.leaveType,
          Remaining = SUM(l.Debit - l.Credit),
          es.DESCRIPTION AS EmployeeStatus,
          e.Position,
          d.Description AS Department 
      FROM 
          [UE database]..LeaveLedger l
      JOIN 
          [UE database]..Employee e ON l.code = e.EmployeeCode
      JOIN 
          [UE database]..EmployeeStatus es ON e.EmployeeStatus = es.code
      LEFT JOIN
          [UE database]..Department d ON e.DeptCode = d.DeptCode
      WHERE 
          YEAR(l.YearAttributed) = YEAR(GETDATE())
          AND (l.Debit > 0 OR l.Credit > 0)
          AND e.isActive = 1
      GROUP BY 
          l.code,
          YEAR(l.YearAttributed),
          l.leaveType,
          es.DESCRIPTION,
          e.Position,
          d.Description  -- Add this line to include Department Description in GROUP BY
      ORDER BY 
          l.code, Year;
      `;
  
      const result = await pool.request().query(leaveBalanceQuery);
          
      if (result.recordset.length === 0) {
        return { status: 404, message: 'No Leave Balance Found for any user' };
      }
  
      return result.recordset;
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Failed to retrieve leave balance' };
    }
  },


    // getPendingLeaves: async () => {
    //   try {
    //     const pool = await poolPromise;
    
    //     if (!pool) {
    //       return { status: 500, message: 'Error Connecting to Database' };
    //     }
    
    //     const pendingLeavesQuery = `
    //       SELECT *
    //       FROM HR..LeaveInfo
    //       WHERE Status = 'Pending'
    //     `;
    
    //     const pendingLeavesResult = await pool.request().query(pendingLeavesQuery);
    
    //     return pendingLeavesResult.recordset;
    //   } catch (error) {
    //     console.error(error);
    //     return { status: 500, message: 'Internal Server Error' };
    //   }
    // },


  getPendingLeaves: async () => {
    try {
      const pool = await poolPromise;
  
      if (!pool) {
        return { status: 500, message: 'Error Connecting to Database' };
      }
  
      const pendingLeavesQuery = `
        SELECT LI.*, UE.FirstName, UE.LastName, UE.MiddleInitial
        FROM HR..LeaveInfo AS LI
        JOIN [UE database]..Employee AS UE ON CONVERT(varchar(5), LI.Code) = UE.EmployeeCode
        WHERE LI.Status = 'Pending'
      `;
    
      const pendingLeavesResult = await pool.request().query(pendingLeavesQuery);
  
      return pendingLeavesResult.recordset;
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Internal Server Error' };
    }
  },

  
  
  
  
  getRejectedLeaves: async () => {
    try {
      const pool = await poolPromise;
  
      const leaveRequestsQuery = `
        SELECT LI.*, UE.FirstName, UE.LastName, UE.MiddleInitial 
        FROM HR..LeaveInfo AS LI
        JOIN [UE database]..Employee AS UE on CONVERT(varchar(5), LI.Code) = UE.EmployeeCode
        WHERE LI.Status = 'Rejected'
        AND TimeFrom IS NOT NULL
        AND TimeTo IS NOT NULL
        AND DateFrom IS NOT NULL
        AND DateTo IS NOT NULL
      `;
  
      const rejectLeaveResult = await pool.request().query(leaveRequestsQuery);
  
      return rejectLeaveResult.recordset;
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Error Getting Rejected Leave' };
    }
  },

  getApprovedLeaves: async () => {
    try {
      const pool = await poolPromise;
  
      const leaveRequestsQuery = `
        SELECT LI.*, UE.FirstName, UE.LastName, UE.MiddleInitial 
        FROM HR..LeaveInfo AS LI
        JOIN [UE database]..Employee AS UE on CONVERT(varchar(5), LI.Code) = UE.EmployeeCode
        WHERE LI.Status = 'Approved'
        AND TimeFrom IS NOT NULL
        AND TimeTo IS NOT NULL
        AND DateFrom IS NOT NULL
        AND DateTo IS NOT NULL
      `;
      const approvedLeaveResult = await pool.request().query(leaveRequestsQuery);
  
      return approvedLeaveResult.recordset;
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Error Getting Approved Leave' };
    }
  },


  deleteLeave: async (LeaveID) => {
    const pool = await poolPromise;

    try {
      const leaveInfoQuery = await pool
        .request()
        .input('LeaveID', mssql.Int, LeaveID)
        .query('SELECT * FROM HR..LeaveInfo WHERE LeaveID = @LeaveID');

      const leaveRequest = leaveInfoQuery.recordset[0];

      if (!leaveRequest) {
        return { status: 404, message: 'Leave request not found' };
      }

      const deleteQuery = `
        DELETE FROM HR..LeaveInfo
        WHERE LeaveID = @LeaveID
      `;

      const deleteResult = await trans.runInTransaction(pool, async (request) => {
        return request
          .input('LeaveID', mssql.Int, LeaveID)
          .query(deleteQuery);
      });

      if (deleteResult.rowsAffected[0] === 0) {
        return { status: 500, message: 'Failed to delete leave request' };
      }

      return { status: 200, message: 'Leave request deleted successfully' };
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Failed to delete leave request' };
    }
  },


  updateLeaveAction: async (Status, LeaveID, EmployeeCode) => {
    const pool = await poolPromise;
  
    if (Status === 'Approved' || Status === 'Rejected') {
      const actionTime = new Date();
      let updateLeaveQuery = `
        UPDATE HR..LeaveInfo
        SET Status = @Status,
            ApprovedBy = @EmployeeCode,
            ApprovedDateTime = @ActionTime
      `;
  
      if (Status === 'Rejected') {
        updateLeaveQuery = `
          UPDATE HR..LeaveInfo
          SET Status = @Status,
              RejectBy = @EmployeeCode,
              RejectedDateTime = @ActionTime
        `;
      }
  
      updateLeaveQuery += `
        WHERE LeaveID = @LeaveID
      `;
  
      const result = await trans.runInTransaction(pool, async (request) => {
        const updateResult = await request
          .input('Status', mssql.NVarChar, Status)
          .input('EmployeeCode', mssql.Int, EmployeeCode)
          .input('ActionTime', mssql.DateTime, actionTime)
          .input('LeaveID', mssql.Int, LeaveID)
          .query(updateLeaveQuery);
  
        // If the leave is approved, insert data into [UE database]..LeaveLedger
        if (Status === 'Approved') {
          const leaveInfoResult = await request
            .input('LeaveIDRequest', mssql.Int, LeaveID)
            .query(`
              SELECT *
              FROM HR..LeaveInfo
              WHERE LeaveID = @LeaveIDRequest
            `);
  
          const leaveInfo = leaveInfoResult.recordset[0];
  
          await request
            .input('EmployeeCodeReq', mssql.Int, leaveInfo.Code)
            .input('LeaveTypeReq', mssql.NVarChar, leaveInfo.LeaveType)
            .input('TransDateReq', mssql.DateTime, leaveInfo.TransDate)
            .input('ITEMTYPEReq', mssql.NVarChar, leaveInfo.ITEMTYPE)
            .input('YearAttributedReq', mssql.NVarChar, leaveInfo.YearAttributed)
            .input('YearEffectivityReq', mssql.NVarChar, leaveInfo.YearEffectivity)
            .input('RemarksReq', mssql.NVarChar, leaveInfo.Remarks)
            .input('ReferenceNoReq', mssql.Int, leaveInfo.LeaveID)
            .input('CreditReq', mssql.Float, leaveInfo.Days)
            .query(`
              INSERT INTO [UE database]..LeaveLedger
              (Code, LeaveType, TransDate, ITEMTYPE, YearAttributed, YearEffectivity, Remarks, ReferenceNo, Credit)
              VALUES
              (@EmployeeCodeReq, @LeaveTypeReq, @TransDateReq, @ITEMTYPEReq, @YearAttributedReq, @YearEffectivityReq, @RemarksReq, @ReferenceNoReq, @CreditReq)
            `);
        }
  
        return updateResult.rowsAffected[0];
      });
  
      return result;
    } else {
      return 0;
    }
  },
  

  
  


  updateAndValidateLeave: async (leaveId, EmployeeCode, LeaveType, Days, TimeFrom, TimeTo, DateFrom, DateTo, Reason) => {
    const pool = await poolPromise;

    const formattedTimeFrom = TimeFrom.substring(0, 5);
    const formattedTimeTo = TimeTo.substring(0, 5);

    const hourFrom = parseInt(formattedTimeFrom.split(':')[0]);
    const hourTo = parseInt(formattedTimeTo.split(':')[0]);
    const amOrPmFrom = hourFrom >= 12 ? ' PM' : ' AM';
    const amOrPmTo = hourTo >= 12 ? ' PM' : ' AM';

    const formattedTimeFromFinal = (hourFrom % 12 || 12) + formattedTimeFrom.slice(2) + amOrPmFrom;
    const formattedTimeToFinal = (hourTo % 12 || 12) + formattedTimeTo.slice(2) + amOrPmTo;

    const checkLeaveOwnershipQuery = `
      SELECT Code
      FROM HR..LeaveInfo
      WHERE LeaveID = @LeaveID;
    `;

    const checkLeaveOwnershipResult = await pool
      .request()
      .input('LeaveID', mssql.Int, leaveId)
      .query(checkLeaveOwnershipQuery);

      const codeFromDatabase = checkLeaveOwnershipResult.recordset[0].Code;

      const trimmedCode = typeof codeFromDatabase === 'number' ? codeFromDatabase.toString() : codeFromDatabase;
      const trimmedEmployeeCode = typeof EmployeeCode === 'string' ? EmployeeCode.trim().toLowerCase() : EmployeeCode;

      if (checkLeaveOwnershipResult.recordset.length === 0 || trimmedCode !== trimmedEmployeeCode) {
        return { status: 401, message: 'Unauthorized access' };
      };

    const updateLeaveQuery = `
      UPDATE HR..LeaveInfo
      SET Days = @Days,
          TimeFrom = @TimeFrom,
          TimeTo = @TimeTo,
          DateFrom = @DateFrom,
          DateTo = @DateTo,
          LeaveType = @LeaveType,
          Reason = @Reason
      WHERE LeaveID = @LeaveID;
    `;

    const updateResult = 
    await trans.runInTransaction(pool, async (request) => {
      return request
        .input('Days', mssql.Float, Days)
        .input('TimeFrom', mssql.NVarChar, formattedTimeFromFinal)
        .input('TimeTo', mssql.NVarChar, formattedTimeToFinal)
        .input('DateFrom', mssql.Date, DateFrom)
        .input('DateTo', mssql.Date, DateTo)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .input('Reason', mssql.NVarChar, Reason)
        .input('LeaveID', mssql.Int, leaveId)
        .query(updateLeaveQuery);
    });

    if (updateResult.rowsAffected[0] === 0) {
      return { status: 500, message: 'Failed to update leave request' };
    }

    return { status: 200, message: 'Leave request updated successfully' };
  },


  // updateLeaveValue: async function (LeaveType, increment, currentYear) {
  //   try {
  //     const pool = await poolPromise;

  //     const updateVLQuery = `
  //     UPDATE LeaveInfo
  //     SET Value = Value + @Increment,
  //         Days = Days + @Increment
  //     WHERE LeaveType = @LeaveType
  //     AND YEAR(YearGain) = @CurrentYear
  //   `;

  //     const result = await pool
  //     .request()
  //     .input('Increment', mssql.Float, increment)
  //     .input('LeaveType', mssql.NVarChar, LeaveType)
  //     .input('CurrentYear', mssql.Int, currentYear)
  //     .query(updateVLQuery);

  //     return result.rowsAffected[0];
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  updateLeaveValue: async (LeaveType, increment, currentYear) => {
    try {
      const pool = await poolPromise;
  
      const updateVLQuery = `
        UPDATE LeaveInfo
        SET Value = Value + @Increment,
            Days = Days + @Increment
        WHERE LeaveType = @LeaveType
        AND YEAR(YearGain) = @CurrentYear
      `;
  
      const result = await pool
        .request()
        .input('Increment', mssql.Float, increment)
        .input('LeaveType', mssql.NVarChar, LeaveType)
        .input('CurrentYear', mssql.Int, currentYear)
        .query(updateVLQuery);
  
      return result.rowsAffected[0];
    } catch (error) {
      console.error(error);
      return { status: 500, message: 'Error Updating Leave Value' };
    }
  },


  // updateLeaveBalanceYearly: async function(type, initialValue, remarkPrefix, currentYear) {
  //   try {
  //     const pool = await poolPromise;
  //     const insertLeaveTypeQuery = `
  //       INSERT INTO LeaveInfo (UserID, LeaveType, Value, YearGain, TransDate, ValueType, Status, ApprovedBy, ApproveDateTime, Days, Remarks)
  //       SELECT UserID, @LeaveType, @InitialValue, @CurrentYear, GETDATE(), 'Credit', 'Approved', 'System', GETDATE(), @InitialValue, @RemarkPrefix + CAST(@CurrentYear AS VARCHAR)
  //       FROM Users;
  //     `;
  
  //     const result = await pool
  //       .request()
  //       .input('LeaveType', mssql.NVarChar, type)
  //       .input('InitialValue', mssql.Float, initialValue)
  //       .input('CurrentYear', mssql.Int, currentYear)
  //       .input('RemarkPrefix', mssql.NVarChar, remarkPrefix)
  //       .query(insertLeaveTypeQuery);
  
  //     if (result.rowsAffected && result.rowsAffected.length > 0 && result.rowsAffected[0] > 0) {
  //       return result.rowsAffected[0];
  //     } else {
  //       throw new Error('Failed to insert leave info. No rows affected.');
  //     }
  //   } catch (error) {
  //     console.error('Error in insertLeaveInfo:', error);
  //     throw error;
  //   }
  // },

  updateLeaveBalanceYearly: async (type, initialValue, remarkPrefix, currentYear) => {
    try {
      const pool = await poolPromise;
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
  
      if (result.rowsAffected && result.rowsAffected.length > 0 && result.rowsAffected[0] > 0) {
        return { rowsAffected: result.rowsAffected[0] };
      } else {
        return { status: 500, message: 'Failed to insert leave info. No rows affected.' };
      }
    } catch (error) {
      console.error('Error in insertLeaveInfo:', error);
      return { status: 500, message: 'Internal Server Error' };
    }
  },







};

module.exports = LeaveRequestModel;
