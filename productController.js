import db from "./db.js";

// GET all products
export const getAllProducts = (callback) => {
  const sql = "SELECT * FROM products";
  db.query(sql, (err, result) => {
    callback(err, result);
  });
};

// GET a single product by ID
export const getProductById = (id, callback) => {
  const sql = "SELECT * FROM products WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    callback(err, result[0]); //The first item from the results array. Since IDs are typically unique, the query should return at most one record
  });
};

// Get a single product movement history
export const getProductHistoryById = (id, callback) => {
  const sql =
    "SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC";

  db.query(sql, [id], (err, result) => {
    callback(err, result);
  });
};

// CREATE a new product
export const createProduct = (productData, callback) => {
  const sql = "INSERT INTO products SET ?";
  db.query(sql, [productData], (err, result) => {
    callback(err, result);
  });
};

// UPDATE a product
export const updateProduct = (id, productData, callback) => {
  const sql = "UPDATE products SET ? WHERE id = ?";
  db.query(sql, [productData, id], (err, result) => {
    callback(err, result);
  });
};

// DELETE a product
export const deleteProduct = (id, callback) => {
  const sql = "DELETE FROM products WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    callback(err, result);
  });
};
