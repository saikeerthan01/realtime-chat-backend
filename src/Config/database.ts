import { Pool } from "pg";

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "chatapp",
    password: "saikeerthan",
    port: 5432,
});

export default pool;