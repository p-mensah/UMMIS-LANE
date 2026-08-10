import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// --- Database Setup ---
const db = new Database('retailos.db');

function addColumnOrIgnore(tableName: string, columnName: string, columnDef: string) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const hasColumn = tableInfo.some(col => col.name === columnName);
    if (!hasColumn) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
    }
  } catch(e) {
    console.error(`Failed to add column ${columnName} to ${tableName}:`, e);
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' -- 'admin', 'staff'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS suppliers_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      loyalty_points INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      barcode TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_contact TEXT,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      user_id INTEGER,
      expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      starting_cash REAL DEFAULT 0,
      ending_cash REAL,
      expected_cash REAL,
      status TEXT DEFAULT 'open',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      old_selling_price REAL NOT NULL,
      new_selling_price REAL NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  addColumnOrIgnore('categories', 'parent_id', 'INTEGER');

  addColumnOrIgnore('sales', 'customer_id', 'INTEGER');
  addColumnOrIgnore('sales', 'shift_id', 'INTEGER');
  addColumnOrIgnore('sales', 'status', "TEXT DEFAULT 'completed'");
  addColumnOrIgnore('sales', 'payment_method', "TEXT DEFAULT 'Cash'");
  addColumnOrIgnore('sale_items', 'status', "TEXT DEFAULT 'sold'");
  addColumnOrIgnore('sale_items', 'cost_price', "REAL DEFAULT 0");
  addColumnOrIgnore('sale_items', 'notes', 'TEXT');
  addColumnOrIgnore('sales', 'refund_reason', 'TEXT');
  addColumnOrIgnore('purchases', 'supplier_id', 'INTEGER');
  addColumnOrIgnore('products', 'category_id', 'INTEGER');
  addColumnOrIgnore('products', 'unit_of_measure', 'TEXT');
  addColumnOrIgnore('products', 'brand', 'TEXT');
  addColumnOrIgnore('products', 'image_url', 'TEXT');
  addColumnOrIgnore('products', 'min_stock_level', 'INTEGER DEFAULT NULL');
  addColumnOrIgnore('users', 'is_active', 'INTEGER DEFAULT 1');

  // Seed default settings
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('low_stock_threshold', '10')").run();

  // Seed default admin and staff
  const checkAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@admin.com');
  if (!checkAdmin) {
    const hash = bcrypt.hashSync('Password', 10);
    // Overwrite the old admin if it exists
    const oldAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@retailos.local');
    if (oldAdmin) {
      db.prepare('UPDATE users SET email = ?, password = ? WHERE email = ?').run('admin@admin.com', hash, 'admin@retailos.local');
    } else {
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin User', 'admin@admin.com', hash, 'admin');
    }
  }

  const checkStaff = db.prepare('SELECT id FROM users WHERE email = ?').get('staff@staff.com');
  if (!checkStaff) {
    const hash = bcrypt.hashSync('Password', 10);
    // Overwrite the old staff if it exists
    const oldStaff = db.prepare('SELECT id FROM users WHERE email = ?').get('staff@retailos.local');
    if (oldStaff) {
      db.prepare('UPDATE users SET email = ?, password = ? WHERE email = ?').run('staff@staff.com', hash, 'staff@retailos.local');
    } else {
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Staff User', 'staff@staff.com', hash, 'staff');
    }
  }
}

// --- App Setup ---
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_retailos_key_change_me';

app.use(cors());
app.use(express.json());

// --- Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// --- API Routes ---

// Auth
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

app.get('/api/auth/me', authenticate, (req: any, res) => {
  res.json({ user: req.user });
});

// Products
app.get('/api/products', authenticate, (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

app.post('/api/products', authenticate, requireAdmin, (req, res) => {
  let { name, sku, category, cost_price, selling_price, stock_quantity, barcode, brand, unit_of_measure, image_url, min_stock_level } = req.body;
  
  if (!sku || sku.trim() === '') {
    let isUnique = false;
    while (!isUnique) {
      sku = 'SKU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
      if (!existing) isUnique = true;
    }
  }

  try {
    const result = db.prepare('INSERT INTO products (name, sku, category, cost_price, selling_price, stock_quantity, barcode, brand, unit_of_measure, image_url, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, sku, category, cost_price, selling_price, stock_quantity || 0, barcode, brand, unit_of_measure, image_url || null, min_stock_level !== undefined && min_stock_level !== '' ? Number(min_stock_level) : null
    );
    res.json({ id: result.lastInsertRowid, sku });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/products/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, sku, category, cost_price, selling_price, barcode, brand, unit_of_measure, image_url, min_stock_level } = req.body;
  const oldProduct: any = db.prepare('SELECT selling_price FROM products WHERE id = ?').get(id);

  const dbTx = db.transaction(() => {
    if (oldProduct && oldProduct.selling_price !== selling_price) {
      db.prepare('INSERT INTO price_history (product_id, old_selling_price, new_selling_price) VALUES (?, ?, ?)').run(id, oldProduct.selling_price, selling_price);
    }
    db.prepare('UPDATE products SET name = ?, sku = ?, category = ?, cost_price = ?, selling_price = ?, barcode = ?, brand = ?, unit_of_measure = ?, image_url = ?, min_stock_level = ? WHERE id = ?').run(
      name, sku, category, cost_price, selling_price, barcode, brand, unit_of_measure, image_url || null, min_stock_level !== undefined && min_stock_level !== '' ? Number(min_stock_level) : null, id
    );
  });
  try {
    dbTx();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/products/:id/price-history', authenticate, (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM price_history WHERE product_id = ? ORDER BY changed_at DESC').all(req.params.id);
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Inventory adjustments
app.post('/api/inventory/adjust', authenticate, (req: any, res) => {
  const { product_id, quantity_change, reason } = req.body;
  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ error: 'Reason must be at least 3 characters long' });
  }
  const dbTx = db.transaction(() => {
    db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(quantity_change, product_id);
    db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(
      product_id, req.user.id, reason, quantity_change
    );
  });
  try {
    dbTx();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/inventory/adjust-bulk', authenticate, requireAdmin, (req: any, res) => {
  const { adjustments, reason } = req.body; // adjustments: { product_id: number, quantity_change: number }[]
  if (!adjustments || adjustments.length === 0) return res.status(400).json({ error: 'No adjustments provided' });
  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ error: 'Reason must be at least 3 characters long' });
  }

  const dbTx = db.transaction(() => {
    for (const adj of adjustments) {
      db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(adj.quantity_change, adj.product_id);
      db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(
        adj.product_id, req.user.id, reason, adj.quantity_change
      );
    }
  });                
  
  try {
    dbTx();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/inventory/adjustments', authenticate, requireAdmin, (req, res) => {
  const adjustments = db.prepare(`
    SELECT sa.*, p.name as product_name, u.name as user_name 
    FROM stock_adjustments sa
    JOIN products p ON sa.product_id = p.id
    JOIN users u ON sa.user_id = u.id
    ORDER BY sa.created_at DESC
  `).all();
  res.json(adjustments);
});

// Sales
app.post('/api/sales', authenticate, (req: any, res) => {
  const { items, customer_id, payment_method } = req.body; // items: { product_id, quantity, unit_price }[]
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });

  const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
  
  const setupSale = db.transaction((saleItems) => {
    // Check for active shift
    const activeShift = db.prepare('SELECT id FROM shifts WHERE user_id = ? AND status = "open"').get(req.user.id) as any;
    const shiftId = activeShift ? activeShift.id : null;

    const saleResult = db.prepare('INSERT INTO sales (user_id, total_amount, customer_id, shift_id, payment_method) VALUES (?, ?, ?, ?, ?)').run(
      req.user.id, total_amount, customer_id || null, shiftId, payment_method || 'Cash'
    );
    const saleId = saleResult.lastInsertRowid;

    for (const item of saleItems) {
      const product = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(item.product_id) as any;
      const costPrice = product ? product.cost_price : 0;

      db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, notes) VALUES (?, ?, ?, ?, ?, ?)').run(
        saleId, item.product_id, item.quantity, item.unit_price, costPrice, item.notes || null
      );
      // Deduct inventory
      db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?').run(item.quantity, item.product_id);
    }

    if (customer_id) {
       db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?').run(Math.floor(total_amount / 10), customer_id);
    }

    return saleId;
  });

  try {
    const saleId = setupSale(items);
    res.json({ success: true, saleId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sales', authenticate, (req, res) => {
  const { startDate, endDate, userId, customerId, category, payment_method, status } = req.query;
  let query = `
    SELECT 
      sales.*, 
      users.name as user_name,
      customers.name as customer_name,
      (SELECT SUM((unit_price - cost_price) * quantity) FROM sale_items WHERE sale_id = sales.id) as profit
    FROM sales 
    JOIN users ON sales.user_id = users.id
    LEFT JOIN customers ON sales.customer_id = customers.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (startDate && endDate) {
    conditions.push('date(sales.created_at) >= date(?) AND date(sales.created_at) <= date(?)');
    params.push(startDate, endDate);
  }
  if (userId) {
    conditions.push('sales.user_id = ?');
    params.push(userId);
  }
  if (customerId) {
    conditions.push('sales.customer_id = ?');
    params.push(customerId);
  }
  if (payment_method) {
    conditions.push('sales.payment_method = ?');
    params.push(payment_method);
  }
  if (status) {
    conditions.push('sales.status = ?');
    params.push(status);
  }
  if (category) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM sale_items si 
        JOIN products p ON si.product_id = p.id 
        WHERE si.sale_id = sales.id AND p.category = ?
      )
    `);
    params.push(category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY sales.created_at DESC';
  
  try {
    const sales = db.prepare(query).all(...params);
    res.json(sales);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sales/:id', authenticate, (req, res) => {
  try {
    const sale = db.prepare(`
      SELECT sales.*, users.name as user_name, customers.name as customer_name
      FROM sales
      JOIN users ON sales.user_id = users.id
      LEFT JOIN customers ON sales.customer_id = customers.id
      WHERE sales.id = ?
    `).get(req.params.id) as any;

    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const items = db.prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(req.params.id);

    res.json({ ...sale, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Purchases
app.post('/api/purchases', authenticate, (req: any, res) => {
  const { supplier_name, supplier_contact, items } = req.body; // items: { product_id, quantity, unit_price }[]
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });

  const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
  
  const setupPurchase = db.transaction((purchaseItems) => {
    const purchaseResult = db.prepare('INSERT INTO purchases (user_id, supplier_name, supplier_contact, total_amount) VALUES (?, ?, ?, ?)').run(
      req.user.id, supplier_name, supplier_contact, total_amount
    );
    const purchaseId = purchaseResult.lastInsertRowid;

    for (const item of purchaseItems) {
      db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(
        purchaseId, item.product_id, item.quantity, item.unit_price
      );
      // Add to inventory
      db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
    }
    return purchaseId;
  });

  try {
    const purchaseId = setupPurchase(items);
    res.json({ success: true, purchaseId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchases', authenticate, (req, res) => {
  const purchases = db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all();
  res.json(purchases);
});

// Reports Overview
// Reports
app.get('/api/reports/transactions', authenticate, requireAdmin, (req, res) => {
  try {
    const sales = db.prepare(`
      SELECT 'sale' as type, sales.id, total_amount as amount, sales.created_at, 'Sale' as description, users.name as user_name
      FROM sales
      JOIN users ON sales.user_id = users.id
    `).all() as any[];

    const purchases = db.prepare(`
      SELECT 'purchase' as type, purchases.id, -total_amount as amount, purchases.created_at, 'Purchase: ' || supplier_name as description, users.name as user_name
      FROM purchases
      JOIN users ON purchases.user_id = users.id
    `).all() as any[];

    const expenses = db.prepare(`
      SELECT 'expense' as type, expenses.id, -amount as amount, expense_date as created_at, 'Expense: ' || description as description, users.name as user_name
      FROM expenses
      LEFT JOIN users ON expenses.user_id = users.id
    `).all() as any[];

    const transactions = [...sales, ...purchases, ...expenses].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json(transactions);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/summary', authenticate, (req, res) => {
  const thresholdRow: any = db.prepare("SELECT value FROM settings WHERE key = 'low_stock_threshold'").get();
  const threshold = parseInt(thresholdRow?.value || '10', 10);

  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as {count: number};
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= COALESCE(min_stock_level, ?)').get(threshold) as {count: number};
  const totalSalesValue = db.prepare('SELECT SUM(total_amount) as total FROM sales WHERE status = "completed"').get() as {total: number};
  const todaySales = db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE status = 'completed' AND date(created_at) = date('now')").get() as {total: number};
  const todayExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date(expense_date) = date('now')").get() as {total: number};

  res.json({
    totalProducts: totalProducts.count,
    lowStockProducts: lowStock.count,
    totalSalesValue: totalSalesValue.total || 0,
    todaySalesValue: todaySales.total || 0,
    todayExpensesValue: todayExpenses.total || 0,
    todayNetProfit: (todaySales.total || 0) - (todayExpenses.total || 0)
  });
});

app.get('/api/reports/daily-summary', authenticate, (req, res) => {
  try {
    const todayRevenue = db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE status = 'completed' AND date(created_at) = date('now')").get() as {total: number};
    const todayExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date(expense_date) = date('now')").get() as {total: number};
    
    const todayGrossProfit = db.prepare(`
      SELECT SUM((si.unit_price - si.cost_price) * si.quantity) as total 
      FROM sale_items si 
      JOIN sales s ON si.sale_id = s.id 
      WHERE s.status = 'completed' AND date(s.created_at) = date('now')
    `).get() as {total: number};

    const salesList = db.prepare(`
      SELECT s.id, s.total_amount, s.payment_method, s.created_at, u.name as cashier_name
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'completed' AND date(s.created_at) = date('now')
      ORDER BY s.created_at DESC
    `).all();

    const expensesList = db.prepare(`
      SELECT e.id, e.description, e.amount, e.expense_date, u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE date(e.expense_date) = date('now')
      ORDER BY e.expense_date DESC
    `).all();

    const revenue = todayRevenue.total || 0;
    const expenses = todayExpenses.total || 0;
    const grossProfit = todayGrossProfit.total || 0;
    const netProfit = revenue - expenses;
    const operatingNetProfit = grossProfit - expenses;

    res.json({
      date: new Date().toISOString().split('T')[0],
      totalRevenue: revenue,
      totalExpenses: expenses,
      netProfit: netProfit,
      grossProfit: grossProfit,
      operatingNetProfit: operatingNetProfit,
      salesCount: salesList.length,
      expensesCount: expensesList.length,
      salesList,
      expensesList
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/low-stock', authenticate, (req, res) => {
  try {
    const thresholdRow: any = db.prepare("SELECT value FROM settings WHERE key = 'low_stock_threshold'").get();
    const threshold = parseInt(thresholdRow?.value || '10', 10);

    const lowStock = db.prepare(`
      SELECT 
        id, name, sku, category, stock_quantity, cost_price, selling_price, 
        unit_of_measure, brand, image_url, min_stock_level,
        COALESCE(min_stock_level, ?) as threshold 
      FROM products 
      WHERE stock_quantity <= COALESCE(min_stock_level, ?) 
      ORDER BY stock_quantity ASC
    `).all(threshold, threshold);
    res.json(lowStock);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/chart', authenticate, (req, res) => {
  try {
    const data = db.prepare(`
      SELECT date(created_at) as date, SUM(total_amount) as total
      FROM sales
      WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all();
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/best-sellers', authenticate, (req, res) => {
  try {
    const data = db.prepare(`
      SELECT p.name, SUM(si.quantity) as total_sold
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.status = 'sold'
      GROUP BY si.product_id
      ORDER BY total_sold DESC
      LIMIT 10
    `).all();
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/sales-trends', authenticate, (req, res) => {
  const { timeframe } = req.query; // 'weekly', 'monthly', 'yearly'
  let groupBy = '';
  let format = '';
  let limit = 12;

  switch (timeframe) {
    case 'weekly':
      // Showing by day for last 7 days
      groupBy = "date(created_at)";
      format = "date(created_at)";
      limit = 7;
      break;
    case 'monthly':
      // Showing by month for last 12 months
      groupBy = "strftime('%Y-%m', created_at)";
      format = "strftime('%Y-%m', created_at)";
      limit = 12;
      break;
    case 'yearly':
      // Showing by year for last 5 years
      groupBy = "strftime('%Y', created_at)";
      format = "strftime('%Y', created_at)";
      limit = 5;
      break;
    default:
      groupBy = "date(created_at)";
      format = "date(created_at)";
      limit = 30;
  }

  try {
    const trends = db.prepare(`
      SELECT ${format} as label, SUM(total_amount) as total
      FROM sales
      WHERE status = 'completed'
      GROUP BY label
      ORDER BY label DESC
      LIMIT ?
    `).all(limit);
    res.json(trends.reverse());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/monthly-trends', authenticate, (req, res) => {
  try {
    const data = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, SUM(total_amount) as total
      FROM sales
      WHERE created_at >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `).all();
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users', authenticate, (req, res) => {
  try {
    const usersList = db.prepare('SELECT id, name, email, role FROM users ORDER BY name ASC').all();
    res.json(usersList);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Users Management (Admin)
app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hash, role);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/status', authenticate, requireAdmin, (req, res) => {
  const { is_active } = req.body;
  try {
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Categories
app.get('/api/categories', authenticate, (req, res) => {
  try {
    const cats = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    res.json(cats);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/categories', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, parent_id } = req.body;
    const result = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(name, parent_id || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/categories/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, parent_id } = req.body;
    db.prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?').run(name, parent_id || null, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const used = db.prepare('SELECT count(*) as count FROM products WHERE category = (SELECT name FROM categories WHERE id = ?)').get(req.params.id) as any;
    if (used.count > 0) {
      return res.status(400).json({ error: 'This category is currently assigned to products and cannot be deleted.' });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Suppliers
app.get('/api/suppliers', authenticate, (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers_list ORDER BY name ASC').all();
    res.json(suppliers);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/suppliers', authenticate, requireAdmin, (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  try {
    const result = db.prepare('INSERT INTO suppliers_list (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)').run(name, contact_person, email, phone, address);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Customers
app.get('/api/customers', authenticate, (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT 
        c.*, 
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE customer_id = c.id AND status = 'completed'), 0) as total_spent
      FROM customers c 
      ORDER BY c.name ASC
    `).all();
    res.json(customers);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/customers', authenticate, (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const result = db.prepare('INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)').run(name, phone, email);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Expenses
app.get('/api/expenses', authenticate, requireAdmin, (req, res) => {
  try {
    const expenses = db.prepare('SELECT expenses.*, users.name as user_name FROM expenses LEFT JOIN users ON expenses.user_id = users.id ORDER BY expense_date DESC').all();
    res.json(expenses);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/expenses', authenticate, requireAdmin, (req: any, res) => {
  const { description, amount } = req.body;
  try {
    const result = db.prepare('INSERT INTO expenses (description, amount, user_id) VALUES (?, ?, ?)').run(description, amount, req.user.id);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Shifts
app.get('/api/shifts/current', authenticate, (req: any, res) => {
  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE user_id = ? AND status = ?').get(req.user.id, 'open');
    res.json(shift || null);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/shifts/open', authenticate, (req: any, res) => {
  const { starting_cash } = req.body;
  try {
    const active = db.prepare('SELECT id FROM shifts WHERE user_id = ? AND status = ?').get(req.user.id, 'open');
    if (active) return res.status(400).json({ error: 'Shift already open' });
    const result = db.prepare('INSERT INTO shifts (user_id, starting_cash) VALUES (?, ?)').run(req.user.id, starting_cash || 0);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/shifts/close', authenticate, (req: any, res) => {
  const { ending_cash } = req.body;
  try {
    const active: any = db.prepare('SELECT id FROM shifts WHERE user_id = ? AND status = ?').get(req.user.id, 'open');
    if (!active) return res.status(400).json({ error: 'No open shift' });
    
    // Calculate expected cash
    // For simplicity, total sales since shift start.
    const salesTotal = db.prepare('SELECT SUM(total_amount) as total FROM sales WHERE shift_id = ? AND status != ?').get(active.id, 'refunded') as any;
    const expected = (salesTotal?.total || 0); // Note: Should probably include start cash, but we'll deal with exact maths later or here
    
    db.prepare('UPDATE shifts SET status = ?, end_time = CURRENT_TIMESTAMP, ending_cash = ?, expected_cash = ? WHERE id = ?').run('closed', ending_cash, expected, active.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sales Refund
app.post('/api/sales/:id/refund', authenticate, (req, res) => {
  const saleId = req.params.id;
  const { reason } = req.body;
  
  try {
    const sale: any = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'refunded') return res.status(400).json({ error: 'Already refunded' });

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all() as any[];
    
    db.transaction(() => {
      db.prepare('UPDATE sales SET status = ?, refund_reason = ? WHERE id = ?').run('refunded', reason || 'No reason specified', saleId);
      db.prepare('UPDATE sale_items SET status = ? WHERE sale_id = ?').run('refunded', saleId);
      for (const item of items) {
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
      }
    })();
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Product Details & History
app.get('/api/products/:id', authenticate, (req, res) => {
  const { id } = req.params;
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    const adjustments = db.prepare(`
      SELECT sa.*, u.name as user_name 
      FROM stock_adjustments sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.product_id = ?
      ORDER BY sa.created_at DESC
    `).all(id);
    
    res.json({ ...product, adjustments });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk Stock Update
app.post('/api/products/bulk-stock-update', authenticate, requireAdmin, (req, res) => {
  const { updates, reason } = req.body; // updates: [{id, quantity_change}]
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid updates' });
  
  const processUpdates = db.transaction((list: any[]) => {
    for (const update of list) {
      db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(update.quantity_change, update.id);
      db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(update.id, (req as any).user.id, reason || 'Bulk Update', update.quantity_change);
    }
  });
  
  try {
    processUpdates(updates);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Settings API
app.get('/api/settings', authenticate, requireAdmin, (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const result: Record<string, string> = {};
  for (const s of settings as any[]) {
    result[s.key] = s.value;
  }
  res.json(result);
});

app.put('/api/settings', authenticate, requireAdmin, (req, res) => {
  const { low_stock_threshold } = req.body;
  if (low_stock_threshold !== undefined) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(low_stock_threshold.toString(), 'low_stock_threshold');
  }
  res.json({ success: true });
});

// --- Server Startup ---
async function startServer() {
  initDb();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
