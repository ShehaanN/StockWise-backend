import { createServer } from "node:http";
import * as productController from "./productController.js";
import url from "node:url";
import { log } from "node:console";

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
    productController.getAllProducts((err, products) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Error fetching products" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(products));
      }
    });
  } else if (pathname.match(/^\/products\/(\d+)$/) && method === "GET") {
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
  } else if (pathname === "/products" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const productData = JSON.parse(body);
      productController.createProduct(productData, (err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Error creating product" }));
        } else {
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: result.insertId, ...productData }));
        }
      });
    });
  } else if (pathname.match(/^\/products\/(\d+)$/) && method === "PUT") {
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
  } else if (pathname.match(/^\/products\/(\d+)$/) && method === "DELETE") {
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
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Route not found" }));
  }
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
