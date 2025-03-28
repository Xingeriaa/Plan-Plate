module.exports = {
    user: 'Xingeira_SQLLogin_1 ', // your SQL Server username (usually 'sa')
    password: '99bfhnecm6', // your SQL Server password
    server: 'plannplate.mssql.somee.com', // your SQL Server instance (use 'localhost\\SQLEXPRESS' if using SQL Express)
    database: 'plannplate', // replace with the name of your database
    options: {
        encrypt: true, // Use encryption for security (set to false if you're not using encrypted connections)
        trustServerCertificate: true, // Set to true if you are not using SSL certificates
    },
    port: 1433, // Default SQL Server port
};
