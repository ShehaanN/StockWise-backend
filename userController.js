import db from "./db.js";

// CREATE a new user
export const createUser = (userData, callback) => {
  const sql = "INSERT INTO users SET ?";
  db.query(sql, [userData], (err, result) => {
    callback(err, result);
  });
};

// GET user by email
export const getUserByEmail = (email, callback) => {
  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], (err, result) => {
    callback(err, result[0]);
  });
};
