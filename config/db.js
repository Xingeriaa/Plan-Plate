const sql = require('mssql');
const config = require('./config'); // Import configuration file

async function connectToDatabase() {
    let pool;
    try {
        pool = await sql.connect(config); // Establish a connection pool
        console.log('Connected to the database successfully!');

        // Example query
        const result = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='plannplate'`);
        console.log('Query result:', result.recordset);
    } catch (err) {
        console.error('Error connecting to the database:', err);
    } finally {
        // Always close the pool
        if (pool) {
            pool.close();
            console.log('Database connection closed.');
        }
    }
}

connectToDatabase();
