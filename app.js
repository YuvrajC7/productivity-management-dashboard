const express = require("express");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { z } = require("zod");

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Productivity Dashboard Backend is Running");
});

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "productivity_db"
});

db.connect(err => {
  if (err) {
    console.error("MySQL Error:", err);
    return;
  }
  console.log("MySQL Connected");
});

db.query(`
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(10)
)`);

db.query(`
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(100),
  description TEXT,
  priority VARCHAR(10),
  status VARCHAR(20),
  deadline DATE,
  tags VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`);

const signupSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["Low", "Medium", "High"]),
  status: z.enum(["Pending", "In Progress", "Completed"]),
  deadline: z.string(),
  tags: z.string().optional()
});

function auth(req, res, next) {
  try {
    const token = req.headers.authorization.split(" ")[1];
    req.user = jwt.verify(token, "SECRET_KEY");
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
}

app.post("/signup", async (req, res) => {
  try {
    const data = signupSchema.parse(req.body);
    const hashed = await bcrypt.hash(data.password, 10);

    db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [data.name, data.email, hashed, data.role || "user"],
      err => {
        if (err) return res.status(400).json({ error: "Email already exists" });
        res.json({ message: "User registered" });
      }
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    db.query(
      "SELECT * FROM users WHERE email = ?",
      [data.email],
      async (err, result) => {
        if (err || result.length === 0)
          return res.status(400).json({ message: "Invalid credentials" });

        const user = result[0];
        const valid = await bcrypt.compare(data.password, user.password);
        if (!valid)
          return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
          { id: user.id, role: user.role },
          "SECRET_KEY"
        );

        res.json({ token });
      }
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/tasks", auth, (req, res) => {
  try {
    const data = taskSchema.parse(req.body);

    db.query(
      `INSERT INTO tasks 
      (user_id, title, description, priority, status, deadline, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        data.title,
        data.description,
        data.priority,
        data.status,
        data.deadline,
        data.tags || ""
      ],
      () => res.json({ message: "Task created" })
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/tasks", auth, (req, res) => {
  db.query(
    "SELECT * FROM tasks WHERE user_id = ?",
    [req.user.id],
    (err, results) => res.json(results)
  );
});

app.put("/tasks/:id", auth, (req, res) => {
  db.query(
    `UPDATE tasks 
     SET title=?, description=?, priority=?, status=?, deadline=?, tags=? 
     WHERE id=? AND user_id=?`,
    [
      req.body.title,
      req.body.description,
      req.body.priority,
      req.body.status,
      req.body.deadline,
      req.body.tags,
      req.params.id,
      req.user.id
    ],
    () => res.json({ message: "Task updated" })
  );
});

app.delete("/tasks/:id", auth, (req, res) => {
  db.query(
    "DELETE FROM tasks WHERE id=? AND user_id=?",
    [req.params.id, req.user.id],
    () => res.json({ message: "Task deleted" })
  );
});

app.get("/tasks/search", auth, (req, res) => {
  const { q, status, priority } = req.query;

  let sql = "SELECT * FROM tasks WHERE user_id=?";
  let params = [req.user.id];

  if (q) {
    sql += " AND (title LIKE ? OR description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  if (status) {
    sql += " AND status=?";
    params.push(status);
  }

  if (priority) {
    sql += " AND priority=?";
    params.push(priority);
  }

  db.query(sql, params, (err, results) => res.json(results));
});

app.get("/dashboard", auth, (req, res) => {
  db.query(
    `
    SELECT
      COUNT(*) AS total_tasks,
      SUM(status='Completed') AS completed_tasks,
      SUM(status!='Completed' AND deadline < CURDATE()) AS overdue_tasks
    FROM tasks
    WHERE user_id = ?
    `,
    [req.user.id],
    (err, result) => {
      const data = result[0];
      data.completion_rate =
        data.total_tasks === 0
          ? 0
          : (data.completed_tasks / data.total_tasks) * 100;

      res.json(data);
    }
  );
});

app.get("/admin/tasks", auth, adminOnly, (req, res) => {
  db.query("SELECT * FROM tasks", (err, results) => {
    res.json(results);
  });
});

app.get("/admin/dashboard", auth, adminOnly, (req, res) => {
  db.query(
    `
    SELECT
      COUNT(*) AS total_tasks,
      SUM(status='Completed') AS completed_tasks,
      SUM(status!='Completed' AND deadline < CURDATE()) AS overdue_tasks
    FROM tasks
    `,
    (err, result) => {
      const data = result[0];
      data.completion_rate =
        data.total_tasks === 0
          ? 0
          : (data.completed_tasks / data.total_tasks) * 100;

      res.json(data);
    }
  );
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
