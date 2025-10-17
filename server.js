import { createServer } from "node:http";
import * as productController from "./productController.js";
import * as userController from "./userController.js";
import * as appController from "./appController.js";
import url from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import db from "./db.js";
import busboy from "busboy"; // The multipart form parser
import { v2 as cloudinary } from "cloudinary";
const PORT = process.env.PORT || 3000;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// authentication for authorized users
const verifyToken = (req, res) => {
  const authHeader =
    req.headers["Authorization"] || req.headers["authorization"];
  // if (!authHeader || !authHeader.startsWith("Bearer ")) {
  //   res.writeHead(401, { "Content-Type": "application/json" });
  //   res.end(JSON.stringify({ message: "No token provided" }));
  //   return null;
  // }
  // const token = authHeader.split(" ")[1];

  const token = authHeader;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload;
  } catch (error) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Invalid token" }));
    return null;
  }
};

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "*"
    // "Content-Type",
    // "Authorization"
  );

  // Handle preflight OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;
  const method = req.method;

  // Simple router

  if (pathname === "/products" && method === "GET") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    const { search } = parsedUrl.query;
    productController.getAllProducts((err, products) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Error fetching products" }));
      } else {
        let filteredProducts = products;
        if (search) {
          filteredProducts = products.filter((product) =>
            product.name.toLowerCase().includes(search.toLowerCase())
          );
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(filteredProducts));
      }
    });
  } else if (pathname === "/appsettings" && method === "GET") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }

    appController.getAppSettings((err, result) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Error fetching app settings" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      }
    });
    try {
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Server error during app settings retrieval",
        })
      );
    }
  } else if (pathname === "/products/movements" && method === "GET") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    productController.getProductsMovements((err, result) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Error fetching movement history" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      }
    });
  } else if (pathname.match(/^\/products\/(\d+)$/) && method === "GET") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    const id = pathname.split("/")[2];
    productController.getProductById(id, (err, product) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Error fetching product" }));
      } else if (!product) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Product not found" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(product));
      }
    });
  } else if (
    pathname.match(/^\/products\/(\d+)\/stock-history$/) &&
    method === "GET"
  ) {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }

    const productId = pathname.split("/")[2];
    productController.getProductHistoryById(
      productId,
      "OUT",
      (err, history) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ message: "Error fetching product history" })
          );
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(history));
        }
      }
    );
  } else if (pathname === "/products" && method === "POST") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }

    const contentType = req.headers["content-type"];

    // Handle multipart form data (with file upload)
    if (contentType && contentType.includes("multipart/form-data")) {
      const bb = busboy({ headers: req.headers });

      const fields = {};
      let imageUrl = null;
      let uploadPromise = null;

      bb.on("field", (fieldname, val) => {
        console.log(`Processing field ${fieldname}: ${val}`);
        fields[fieldname] = val;
      });

      bb.on("file", (fieldname, file, info) => {
        console.log(`Processing file ${info.filename}`);

        uploadPromise = new Promise((resolve, reject) => {
          // Set timeout for upload
          const timeout = setTimeout(() => {
            reject(new Error("Upload timeout after 30 seconds"));
          }, 30000);

          // Create a Cloudinary upload stream
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "inventory_products",
              timeout: 30000,
              resource_type: "auto",
            },
            (error, result) => {
              clearTimeout(timeout);
              if (error) {
                console.error("Cloudinary Upload Error:", error);
                return reject(
                  new Error(`Cloudinary upload failed: ${error.message}`)
                );
              }
              // When Cloudinary is done, resolve the promise with the URL
              console.log("Upload successful:", result.secure_url);
              resolve(result.secure_url);
            }
          );
          file.pipe(uploadStream);
        });
      });

      bb.on("finish", async () => {
        console.log("Busboy finished parsing the form.");

        try {
          // If there was a file upload, wait for it to complete
          if (uploadPromise) {
            console.log("Waiting for file upload to complete...");
            imageUrl = await uploadPromise;
            console.log("File upload completed, imageUrl:", imageUrl);
          }

          // At this point, `fields` has all text data and `imageUrl` has the cloud URL.
          // Now, we can perform the database insertion.
          const { name, price, stock, category_id, description, barcode } =
            fields;
          if (!name || !price || !stock) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                message: "Name, price, and stock are required.",
              })
            );
          }

          const sql =
            "INSERT INTO products (name, price, stock, category_id, description, barcode, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?)";
          db.query(
            sql,
            [
              name,
              price,
              stock,
              category_id || null,
              description || null,
              barcode || null,
              imageUrl,
            ],
            (err, result) => {
              if (err) {
                console.error("Database Insert Error:", err);
                res.writeHead(500, { "Content-Type": "application/json" });
                return res.end(
                  JSON.stringify({
                    message: "Database error while adding product.",
                  })
                );
              }
              res.writeHead(201, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  message: "Product added successfully",
                  productId: result.insertId,
                  imageUrl,
                })
              );
            }
          );
        } catch (error) {
          console.error("Error in file upload process:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: `Upload failed: ${error.message}`,
            })
          );
        }
      });

      // Pipe the request stream into busboy
      req.pipe(bb);
      return;
    }

    // Handle regular JSON requests (without file upload)
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const { name, price, stock, category_id, description, barcode } =
          JSON.parse(body);

        if (!name || !price || !stock) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ message: "Name, price, and stock are required." })
          );
        }

        const sql =
          "INSERT INTO products (name, price, stock, category_id, description, barcode) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(
          sql,
          [
            name,
            price,
            stock,
            category_id || null,
            description || null,
            barcode || null,
          ],
          (err, result) => {
            if (err) {
              console.error("Database Insert Error:", err);
              res.writeHead(500, { "Content-Type": "application/json" });
              return res.end(
                JSON.stringify({
                  message: "Database error while adding product.",
                })
              );
            }
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                message: "Product added successfully",
                productId: result.insertId,
              })
            );
          }
        );
      } catch (error) {
        console.error("JSON Parse Error:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Invalid JSON format." }));
      }
    });
  } else if (pathname === "/categories" && method === "POST") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const categoryData = JSON.parse(body);
        productController.createCategory(categoryData, (err, result) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Error creating category" }));
          } else {
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ id: result.insertId, ...categoryData }));
          }
        });
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "Server Error during category creation" })
      );
    }
  } else if (pathname.match(/^\/products\/(\d+)$/) && method === "PUT") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    const id = pathname.split("/")[2];
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const productData = JSON.parse(body);
      productController.updateProduct(id, productData, (err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Error updating product" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: `Product ${id} updated` }));
        }
      });
    });
  } else if (pathname.match(/^\/appSettings\/(\d+)$/) && method === "PUT") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      const id = pathname.split("/")[2];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const settings = JSON.parse(body);
        appController.updateAppSettings(settings, id, (err, result) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Error updating app settings" }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: `App settings updated` }));
          }
        });
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "Server Error during app settings update" })
      );
    }
  } else if (pathname.match(/^\/categories\/(\d+)$/) && method === "PUT") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      const id = pathname.split("/")[2];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const categoryData = JSON.parse(body);
        productController.updateCategory(id, categoryData, (err, result) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Error updating category" }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: `Category ${id} updated` }));
          }
        });
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "Server Error during category update" })
      );
    }
  } else if (pathname === "/users/change-password" && method === "PUT") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      const id = pathname.split("/")[2];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        const userData = JSON.parse(body);
        const { currentPassword, newPassword } = userData;
        const userId = user.id;

        userController.getUserById(userId, async (err, user) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Error fetching user" }));
          }

          const isMatch = await bcrypt.compare(currentPassword, user.password);

          if (!isMatch) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({ message: "Incorrect current password" })
            );
          }

          const hashedNewPassword = await bcrypt.hash(newPassword, 10);

          userController.changePassword(
            userId,
            hashedNewPassword,
            (err, result) => {
              if (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({ message: "Error during password change" })
                );
              }
              res.end(
                JSON.stringify({ message: "Password updated successfully" })
              );
            }
          );
        });
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "Server error during password change" })
      );
    }
  } else if (pathname.match(/^\/products\/(\d+)$/) && method === "DELETE") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      const id = pathname.split("/")[2];
      productController.deleteProduct(id, (err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Error deleting product" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: `Product ${id} deleted` }));
        }
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "Server error during product deletion" })
      );
    }
  } else if (pathname.match(/^\/categories\/(\d+)$/) && method === "DELETE") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      const id = pathname.split("/")[2];
      productController.deleteCategory(id, (err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Error deleting category" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: `Category ${id} deleted` }));
        }
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "Server error during category deletion" })
      );
    }
  } else if (pathname === "/register" && method === "POST") {
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        const { email, password } = JSON.parse(body);
        if (!email || !password) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ message: "Email and password are required" })
          );
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        userController.createUser(
          { email, password: hashedPassword },
          (err, result) => {
            if (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ message: "Error creating user" }));
            } else {
              res.writeHead(201, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  message: "Registration successful",
                  data: {
                    Id: result.insertId,
                    email: email,
                  },
                })
              );
            }
          }
        );
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Server error during registration" }));
    }
  } else if (pathname === "/transactions" && method === "POST") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        const { product_id, quantity_change, reason, type, balance } =
          JSON.parse(body);
        if (!product_id || !quantity_change || !reason) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ message: "All fields are required" })
          );
        }

        productController.createStockMovement(
          { product_id, quantity_change, reason, type, balance },
          (err, result) => {
            if (err) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ message: "Error processing transaction" })
              );
            } else {
              res.writeHead(201, { "Content-Type": "application/json" });
              res.end(JSON.stringify(result));
            }
          }
        );
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Server error processing this transaction",
        })
      );
    }
  } else if (pathname === "/stats" && method === "GET") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      productController.getStats((err, stats) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Error fetching stats" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(stats));
        }
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Error fetching stats" }));
    }
  } else if (pathname === "/categories" && method === "GET") {
    const user = verifyToken(req, res);
    if (!user) {
      return;
    }
    try {
      productController.getAllCategories((err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Error fetching categories" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        }
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Error fetching categories" }));
    }
  } else if (pathname === "/login" && method === "POST") {
    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        const { email, password } = JSON.parse(body);
        if (!email || !password) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ message: "Email and password are required" })
          );
        }
        userController.getUserByEmail(email, async (err, user) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Error fetching user" }));
          }
          if (!user) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Invalid credentials" }));
          }
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Invalid credentials" }));
          }
          // Generate JWT
          const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Login successful", token }));
        });
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Server error during login" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Route not found" }));
  }
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
