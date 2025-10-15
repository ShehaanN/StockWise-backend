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

export const getProductsMovements = (callback) => {
  const sql = `
    SELECT 
      sm.*,
      p.name as product_name,
      p.price as product_price
    FROM stock_movements sm 
    LEFT JOIN products p ON sm.product_id = p.id 
    ORDER BY sm.created_at DESC
  `;
  db.query(sql, (err, result) => {
    callback(err, result);
  });
};

// begin a transaction to create a stock movement and update product stock
export const createStockMovement = (
  { product_id, quantity_change, reason, type, balance },
  callback
) => {
  db.beginTransaction((err) => {
    if (err) {
      return callback(err);
    }
    // 1. Insert into stock_movements
    const movementSql = "INSERT INTO stock_movements SET ?";
    const movementData = { product_id, quantity_change, reason, type, balance };
    db.query(movementSql, movementData, (err, result) => {
      if (err) {
        return db.rollback(() => {
          callback(err);
        });
      }
      const movementId = result.insertId;
      // 2. Update the stock in the products table

      const productSql = "UPDATE products SET stock = stock + ? WHERE id = ?";
      db.query(productSql, [quantity_change, product_id], (err, result) => {
        if (err) {
          return db.rollback(() => {
            callback(err);
          });
        }

        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              callback(err);
            });
          }

          callback(null, { id: movementId, ...movementData });
        });
      });
    });
  });
};

// GET stats

export const getStats = (callback) => {
  const queries = {
    totalProducts: "SELECT COUNT(*) as count FROM products",
    totalValue: "SELECT SUM(price * stock) as value FROM products",
    lowStockItems: "SELECT COUNT(*) as count FROM products WHERE stock < 10", // threshold = 10
  };

  // Run queries in parallel
  Promise.all([
    new Promise((resolve, reject) =>
      db.query(queries.totalProducts, (err, result) =>
        err ? reject(err) : resolve(result[0].count)
      )
    ),
    new Promise((resolve, reject) =>
      db.query(queries.totalValue, (err, result) =>
        err ? reject(err) : resolve(result[0].value)
      )
    ),
    new Promise((resolve, reject) =>
      db.query(queries.lowStockItems, (err, result) =>
        err ? reject(err) : resolve(result[0].count)
      )
    ),
  ])
    .then(([totalProducts, totalValue, lowStockItems]) => {
      callback(null, { totalProducts, totalValue, lowStockItems });
    })
    .catch((err) => {
      callback(err, null);
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
