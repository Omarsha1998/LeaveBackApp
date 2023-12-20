const mssql = require('mssql');

async function runInTransaction(pool, callback) {
  let transaction;
  try {
    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const result = await callback(new mssql.Request(transaction));

    await transaction.commit();
    return result;
  } catch (error) {

      await transaction.rollback();
      throw error;
  }
}

module.exports = {
  runInTransaction,
};
