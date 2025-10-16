import db from "./db.js";

export const getAppSettings = (callback) => {
  const sql = "SELECT * FROM app_settings";
  db.query(sql, (err, result) => {
    callback(err, result[0]);
  });
};

export const updateAppSettings = (settings, id, callback) => {
  const sql = "UPDATE app_settings SET ? WHERE id = ?";
  db.query(sql, [settings, id], (err, result) => {
    callback(err, result);
  });
};
