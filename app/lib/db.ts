const { Pool } = require('pg');

// const conn = new Pool({
//   user: process.env.POSTGRES_USER,
//   password: process.env.POSTGRES_PASSWORD,
//   host: process.env.POSTGRES_HOST,
//   port: process.env.POSTGRES_PORT,
//   database: process.env.POSTGRES_DATABASE,
// });
const conn = new Pool({
  connectionString: process.env.POSTGRES_URL_RENDER,
  ssl: process.env.POSTGRES_URL_RENDER ? true : false,
});

export default conn;
