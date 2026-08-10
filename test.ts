import Database from 'better-sqlite3';

const db = new Database('retailos.db');
const users = db.prepare('SELECT id, email, role, password FROM users').all();
console.log(users);
