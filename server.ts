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

  // Populate initial demo database if fresh
  seedDatabase(db);
}

function seedDatabase(dbInstance: any) {
  try {
    const prodCount: any = dbInstance.prepare('SELECT COUNT(*) as count FROM products').get();
    if (prodCount && prodCount.count >= 5) return;

    console.log('Seeding demo database for Ummis Lane Enterprise...');

    const categories = ['Beverages', 'Groceries', 'Bakery & Pastry', 'Household & Cleaning', 'Snacks & Sweets', 'Dairy & Frozen', 'Personal Care'];
    for (const cat of categories) {
      dbInstance.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(cat);
    }

    const adminUser: any = dbInstance.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    const staffUser: any = dbInstance.prepare('SELECT id FROM users WHERE role = ?').get('staff');
    const adminId = adminUser?.id || 1;
    const staffId = staffUser?.id || 2;

    dbInstance.prepare('INSERT OR IGNORE INTO suppliers_list (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)').run(
      'Nestlé Ghana Ltd', 'John Addo', 'orders@nestle.com.gh', '0302111222', 'Industrial Area, Tema'
    );
    dbInstance.prepare('INSERT OR IGNORE INTO suppliers_list (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)').run(
      'GB Foods Ghana', 'Sarah Quaye', 'sales@gbfoods.com', '0302333444', 'Spintex Road, Accra'
    );
    dbInstance.prepare('INSERT OR IGNORE INTO suppliers_list (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)').run(
      'Wilmar Africa Ltd', 'Emmanuel Darko', 'info@wilmar.com', '0302555666', 'Heavy Industrial Area, Tema'
    );

    dbInstance.prepare('INSERT OR IGNORE INTO customers (name, phone, email, loyalty_points) VALUES (?, ?, ?, ?)').run('Ama Serwaa', '0244123456', 'ama@gmail.com', 120);
    dbInstance.prepare('INSERT OR IGNORE INTO customers (name, phone, email, loyalty_points) VALUES (?, ?, ?, ?)').run('Kojo Mensah', '0208987654', 'kojo.m@gmail.com', 85);
    dbInstance.prepare('INSERT OR IGNORE INTO customers (name, phone, email, loyalty_points) VALUES (?, ?, ?, ?)').run('Abena Osei', '0277334455', 'abena@yahoo.com', 210);

    const sampleProducts = [
      { name: 'Ideal Milk 160g', sku: 'MLK-160', category: 'Dairy & Frozen', cost_price: 5.50, selling_price: 7.00, stock_quantity: 8, barcode: '6001001', brand: 'Nestlé', unit_of_measure: 'Cans', min_stock_level: 15 },
      { name: 'Milo Beverage 400g', sku: 'MLO-400', category: 'Beverages', cost_price: 22.00, selling_price: 28.50, stock_quantity: 45, barcode: '6001002', brand: 'Nestlé', unit_of_measure: 'Tins', min_stock_level: 10 },
      { name: 'Gino Tomato Paste 70g', sku: 'GNO-070', category: 'Groceries', cost_price: 2.20, selling_price: 3.00, stock_quantity: 3, barcode: '6001003', brand: 'Gino', unit_of_measure: 'Sachets', min_stock_level: 20 },
      { name: 'Royal Aroma Rice 5kg', sku: 'RICE-05K', category: 'Groceries', cost_price: 85.00, selling_price: 110.00, stock_quantity: 0, barcode: '6001004', brand: 'Royal Aroma', unit_of_measure: 'Bags', min_stock_level: 5 },
      { name: 'Frytol Cooking Oil 1L', sku: 'OIL-01L', category: 'Groceries', cost_price: 32.00, selling_price: 42.00, stock_quantity: 28, barcode: '6001005', brand: 'Frytol', unit_of_measure: 'Bottles', min_stock_level: 8 },
      { name: 'Geisha Mackerel 425g', sku: 'GSH-425', category: 'Groceries', cost_price: 14.00, selling_price: 18.50, stock_quantity: 18, barcode: '6001006', brand: 'Geisha', unit_of_measure: 'Cans', min_stock_level: 10 },
      { name: 'Bel-Aqua Mineral Water 750ml', sku: 'WAT-750', category: 'Beverages', cost_price: 1.50, selling_price: 2.50, stock_quantity: 120, barcode: '6001007', brand: 'Bel-Beverages', unit_of_measure: 'Bottles', min_stock_level: 30 },
      { name: 'Key Soap 800g', sku: 'SOAP-800', category: 'Household & Cleaning', cost_price: 18.00, selling_price: 24.00, stock_quantity: 4, barcode: '6001008', brand: 'Unilever', unit_of_measure: 'Bars', min_stock_level: 10 },
      { name: 'Pepsodent Toothpaste 175g', sku: 'PEP-175', category: 'Personal Care', cost_price: 12.00, selling_price: 16.00, stock_quantity: 35, barcode: '6001009', brand: 'Pepsodent', unit_of_measure: 'Tubes', min_stock_level: 10 },
      { name: 'This Way Chocolate Drink 30g', sku: 'TSW-030', category: 'Beverages', cost_price: 1.80, selling_price: 2.50, stock_quantity: 85, barcode: '6001010', brand: 'This Way', unit_of_measure: 'Sachets', min_stock_level: 25 }
    ];

    for (const p of sampleProducts) {
      dbInstance.prepare(`
        INSERT OR IGNORE INTO products (name, sku, category, cost_price, selling_price, stock_quantity, barcode, brand, unit_of_measure, min_stock_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(p.name, p.sku, p.category, p.cost_price, p.selling_price, p.stock_quantity, p.barcode, p.brand, p.unit_of_measure, p.min_stock_level);
    }

    const prods = dbInstance.prepare('SELECT id, name, cost_price, selling_price FROM products').all() as any[];

    if (prods.length > 1) {
      dbInstance.prepare('INSERT INTO price_history (product_id, old_selling_price, new_selling_price, changed_at) VALUES (?, ?, ?, datetime("now", "-15 days"))').run(prods[1].id, 25.00, 28.50);
      dbInstance.prepare('INSERT INTO price_history (product_id, old_selling_price, new_selling_price, changed_at) VALUES (?, ?, ?, datetime("now", "-30 days"))').run(prods[3].id, 100.00, 110.00);
    }

    for (const p of prods) {
      dbInstance.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change, created_at) VALUES (?, ?, ?, ?, datetime("now", "-20 days"))').run(
        p.id, adminId, 'Initial Stock Count Audit', 50
      );
    }
    if (prods.length > 0) {
      dbInstance.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change, created_at) VALUES (?, ?, ?, ?, datetime("now", "-5 days"))').run(
        prods[0].id, adminId, 'Damaged Box Write-off', -2
      );
    }
    if (prods.length > 2) {
      dbInstance.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change, created_at) VALUES (?, ?, ?, ?, datetime("now", "-2 days"))').run(
        prods[2].id, adminId, 'Stock Recount Verification', -5
      );
    }

    if (prods.length > 0) {
      const pRes1 = dbInstance.prepare('INSERT INTO purchases (user_id, supplier_name, supplier_contact, total_amount, created_at) VALUES (?, ?, ?, ?, datetime("now", "-12 days"))').run(
        adminId, 'Nestlé Ghana Ltd', '0302111222', 1500.00
      );
      const pId1 = pRes1.lastInsertRowid;
      dbInstance.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(pId1, prods[0].id, 100, 5.50);
      if (prods.length > 1) {
        dbInstance.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(pId1, prods[1].id, 40, 22.00);
      }

      const pRes2 = dbInstance.prepare('INSERT INTO purchases (user_id, supplier_name, supplier_contact, total_amount, created_at) VALUES (?, ?, ?, ?, datetime("now", "-3 days"))').run(
        adminId, 'Wilmar Africa Ltd', '0302555666', 2400.00
      );
      const pId2 = pRes2.lastInsertRowid;
      if (prods.length > 4) {
        dbInstance.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(pId2, prods[4].id, 50, 32.00);
      }
      if (prods.length > 6) {
        dbInstance.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(pId2, prods[6].id, 150, 1.50);
      }
    }

    const shift1 = dbInstance.prepare('INSERT INTO shifts (user_id, start_time, end_time, starting_cash, ending_cash, expected_cash, status) VALUES (?, datetime("now", "-1 day", "-8 hours"), datetime("now", "-1 day"), 200, 850, 850, "closed")').run(staffId);
    const activeShift = dbInstance.prepare('INSERT INTO shifts (user_id, start_time, starting_cash, status) VALUES (?, datetime("now", "-4 hours"), 250, "open")').run(staffId);
    const shiftId = activeShift.lastInsertRowid;

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const daysAgo = i;
      const numSales = 3;
      for (let s = 0; s < numSales; s++) {
        const isToday = daysAgo === 0;
        const hourOffset = 8 + (s * 3);
        const created_at = isToday 
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), hourOffset, 15).toISOString().replace('T', ' ').substring(0, 19)
          : new Date(now.getTime() - daysAgo * 24 * 3600 * 1000 + s * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);

        const userId = (s % 2 === 0) ? staffId : adminId;
        const pm = s % 3 === 0 ? 'Momo' : (s % 3 === 1 ? 'Cash' : 'Card');
        const custId = (s % 3) + 1;

        const p1 = prods[s % prods.length];
        const p2 = prods[(s + 3) % prods.length];
        const qty1 = Math.floor(Math.random() * 3) + 1;
        const qty2 = Math.floor(Math.random() * 2) + 1;
        const total = (p1.selling_price * qty1) + (p2.selling_price * qty2);

        const saleRes = dbInstance.prepare(`
          INSERT INTO sales (user_id, customer_id, shift_id, total_amount, payment_method, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'completed', ?)
        `).run(userId, custId, isToday ? shiftId : shift1.lastInsertRowid, total, pm, created_at);

        const sId = saleRes.lastInsertRowid;
        dbInstance.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price) VALUES (?, ?, ?, ?, ?)').run(sId, p1.id, qty1, p1.selling_price, p1.cost_price);
        dbInstance.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price) VALUES (?, ?, ?, ?, ?)').run(sId, p2.id, qty2, p2.selling_price, p2.cost_price);
      }
    }

    dbInstance.prepare('INSERT INTO expenses (description, amount, user_id, expense_date) VALUES (?, ?, ?, datetime("now", "-2 days"))').run('Generator Diesel Fuel', 180.00, adminId);
    dbInstance.prepare('INSERT INTO expenses (description, amount, user_id, expense_date) VALUES (?, ?, ?, datetime("now", "-5 days"))').run('Store Utility Bill (Electricity)', 350.00, adminId);
    dbInstance.prepare('INSERT INTO expenses (description, amount, user_id, expense_date) VALUES (?, ?, ?, datetime("now", "-10 days"))').run('Packaging & Shopping Bags', 120.00, adminId);
    dbInstance.prepare('INSERT INTO expenses (description, amount, user_id, expense_date) VALUES (?, ?, ?, datetime("now"))').run('Store Cleaner Weekly Stipend', 150.00, adminId);

    console.log('Demo database successfully populated!');
  } catch (err) {
    console.error('Error seeding database:', err);
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
    const activeShift = db.prepare("SELECT id FROM shifts WHERE user_id = ? AND status = 'open'").get(req.user.id) as any;
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
      SELECT sales.*, users.name as user_name, customers.name as customer_name, customers.phone as customer_phone, customers.email as customer_email
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
  const totalSalesValue = db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE status = 'completed'").get() as {total: number};
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
  const { timeframe } = req.query; // '30days', 'weekly', 'monthly', 'yearly'
  
  try {
    if (timeframe === 'weekly') {
      const days: any[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const displayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        days.push({ date: dateStr, label: displayLabel, total: 0, sales_count: 0 });
      }

      const rows = db.prepare(`
        SELECT date(created_at) as dateStr, SUM(total_amount) as total, COUNT(*) as sales_count
        FROM sales
        WHERE status = 'completed' AND created_at >= date('now', '-7 days')
        GROUP BY dateStr
      `).all() as any[];

      const map = new Map(rows.map(r => [r.dateStr, r]));
      const result = days.map(day => {
        const found = map.get(day.date);
        return {
          ...day,
          total: found ? found.total : 0,
          sales_count: found ? found.sales_count : 0
        };
      });
      return res.json(result);
    } else if (timeframe === 'monthly') {
      const data = db.prepare(`
        SELECT strftime('%Y-%m', created_at) as label, SUM(total_amount) as total, COUNT(*) as sales_count
        FROM sales
        WHERE status = 'completed'
        GROUP BY label
        ORDER BY label DESC
        LIMIT 12
      `).all();
      return res.json(data.reverse());
    } else if (timeframe === 'yearly') {
      const data = db.prepare(`
        SELECT strftime('%Y', created_at) as label, SUM(total_amount) as total, COUNT(*) as sales_count
        FROM sales
        WHERE status = 'completed'
        GROUP BY label
        ORDER BY label DESC
        LIMIT 5
      `).all();
      return res.json(data.reverse());
    } else {
      // Default / '30days' / 'daily': Last 30 continuous calendar days
      const days: any[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const displayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        days.push({ date: dateStr, label: displayLabel, total: 0, sales_count: 0 });
      }

      const rows = db.prepare(`
        SELECT date(created_at) as dateStr, SUM(total_amount) as total, COUNT(*) as sales_count
        FROM sales
        WHERE status = 'completed' AND created_at >= date('now', '-30 days')
        GROUP BY dateStr
      `).all() as any[];

      const map = new Map(rows.map(r => [r.dateStr, r]));
      const result = days.map(day => {
        const found = map.get(day.date);
        return {
          ...day,
          total: found ? found.total : 0,
          sales_count: found ? found.sales_count : 0
        };
      });
      return res.json(result);
    }
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

app.get('/api/reports/monthly-summary', authenticate, (req, res) => {
  try {
    const selectedMonth = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;

    const currRevenue = db.prepare(`
      SELECT SUM(total_amount) as total, COUNT(*) as count 
      FROM sales 
      WHERE status = 'completed' AND strftime('%Y-%m', created_at) = ?
    `).get(selectedMonth) as { total: number, count: number };

    const prevRevenue = db.prepare(`
      SELECT SUM(total_amount) as total, COUNT(*) as count 
      FROM sales 
      WHERE status = 'completed' AND strftime('%Y-%m', created_at) = ?
    `).get(prevMonthStr) as { total: number, count: number };

    const currExpenses = db.prepare(`
      SELECT SUM(amount) as total, COUNT(*) as count 
      FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = ?
    `).get(selectedMonth) as { total: number, count: number };

    const prevExpenses = db.prepare(`
      SELECT SUM(amount) as total, COUNT(*) as count 
      FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = ?
    `).get(prevMonthStr) as { total: number, count: number };

    const currGrossProfit = db.prepare(`
      SELECT SUM((si.unit_price - si.cost_price) * si.quantity) as total 
      FROM sale_items si 
      JOIN sales s ON si.sale_id = s.id 
      WHERE s.status = 'completed' AND strftime('%Y-%m', s.created_at) = ?
    `).get(selectedMonth) as { total: number };

    const dailySeries = db.prepare(`
      SELECT 
        d.day,
        COALESCE(s.sales_total, 0) as sales_total,
        COALESCE(e.expense_total, 0) as expense_total,
        (COALESCE(s.sales_total, 0) - COALESCE(e.expense_total, 0)) as net_profit
      FROM (
        SELECT DISTINCT date(created_at) as day FROM sales WHERE strftime('%Y-%m', created_at) = ?
        UNION
        SELECT DISTINCT date(expense_date) as day FROM expenses WHERE strftime('%Y-%m', expense_date) = ?
      ) d
      LEFT JOIN (
        SELECT date(created_at) as day, SUM(total_amount) as sales_total 
        FROM sales WHERE status = 'completed' AND strftime('%Y-%m', created_at) = ?
        GROUP BY date(created_at)
      ) s ON d.day = s.day
      LEFT JOIN (
        SELECT date(expense_date) as day, SUM(amount) as expense_total 
        FROM expenses WHERE strftime('%Y-%m', expense_date) = ?
        GROUP BY date(expense_date)
      ) e ON d.day = e.day
      ORDER BY d.day ASC
    `).all(selectedMonth, selectedMonth, selectedMonth, selectedMonth);

    const staffLeaderboard = db.prepare(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email,
        u.role,
        COUNT(s.id) as total_sales_count,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        CASE WHEN COUNT(s.id) > 0 THEN ROUND(SUM(s.total_amount) / COUNT(s.id), 2) ELSE 0 END as avg_order_value,
        ROUND(COALESCE(SUM(s.total_amount), 0) * 0.02, 2) as estimated_commission
      FROM users u
      LEFT JOIN sales s ON u.id = s.user_id AND s.status = 'completed' AND strftime('%Y-%m', s.created_at) = ?
      GROUP BY u.id
      ORDER BY total_revenue DESC
    `).all(selectedMonth);

    const categoryBreakdown = db.prepare(`
      SELECT 
        COALESCE(p.category, 'Uncategorized') as category,
        SUM(si.quantity) as items_sold,
        SUM(si.unit_price * si.quantity) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' AND strftime('%Y-%m', s.created_at) = ?
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `).all(selectedMonth);

    const revenue = currRevenue.total || 0;
    const pRevenue = prevRevenue.total || 0;
    const expenses = currExpenses.total || 0;
    const pExpenses = prevExpenses.total || 0;
    const netProfit = revenue - expenses;
    const pNetProfit = pRevenue - pExpenses;

    const revenueGrowthMoM = pRevenue > 0 ? (((revenue - pRevenue) / pRevenue) * 100).toFixed(1) : '100.0';
    const netProfitGrowthMoM = pNetProfit > 0 ? (((netProfit - pNetProfit) / Math.abs(pNetProfit)) * 100).toFixed(1) : '100.0';

    res.json({
      month: selectedMonth,
      prevMonth: prevMonthStr,
      revenue,
      prevRevenue: pRevenue,
      revenueGrowthMoM,
      expenses,
      prevExpenses: pExpenses,
      netProfit,
      prevNetProfit: pNetProfit,
      netProfitGrowthMoM,
      grossProfit: currGrossProfit.total || 0,
      salesCount: currRevenue.count || 0,
      expensesCount: currExpenses.count || 0,
      dailySeries,
      staffLeaderboard,
      categoryBreakdown
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/staff-my-summary', authenticate, (req: any, res) => {
  try {
    const userId = req.user.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);

    const activeShift = db.prepare('SELECT * FROM shifts WHERE user_id = ? AND status = ?').get(userId, 'open');

    const todaySales = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
      FROM sales 
      WHERE user_id = ? AND status = 'completed' AND date(created_at) = ?
    `).get(userId, todayStr) as { count: number, total: number };

    const monthSales = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
      FROM sales 
      WHERE user_id = ? AND status = 'completed' AND strftime('%Y-%m', created_at) = ?
    `).get(userId, currentMonthStr) as { count: number, total: number };

    const ranks = db.prepare(`
      SELECT user_id, SUM(total_amount) as rev 
      FROM sales 
      WHERE status = 'completed' AND strftime('%Y-%m', created_at) = ? 
      GROUP BY user_id 
      ORDER BY rev DESC
    `).all(currentMonthStr) as any[];

    const myRankIndex = ranks.findIndex(r => r.user_id === userId);
    const myRank = myRankIndex !== -1 ? myRankIndex + 1 : (ranks.length > 0 ? ranks.length : 1);

    const monthlyTarget = 15000;
    const targetPercentage = Math.min(100, Math.round((monthSales.total / monthlyTarget) * 100));
    const commissionEst = Math.round(monthSales.total * 0.02 * 100) / 100;

    const totalStaffRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    const recentSales = db.prepare(`
      SELECT id, total_amount, payment_method, created_at 
      FROM sales 
      WHERE user_id = ? AND status = 'completed' 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(userId);

    res.json({
      activeShift,
      todaySalesCount: todaySales.count,
      todayRevenue: todaySales.total,
      monthSalesCount: monthSales.count,
      monthRevenue: monthSales.total,
      monthlyTarget,
      targetPercentage,
      commissionEst,
      myRank,
      totalStaffCount: totalStaffRow.count || 1,
      recentSales
    });
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

// Product Full Audit Log (Adjustments, Sales, Purchases/Restocks, Refunds)
app.get('/api/products/:id/audit-log', authenticate, (req, res) => {
  const { id } = req.params;
  try {
    // 1. Stock Adjustments
    const adjustments = db.prepare(`
      SELECT 
        'adjustment' as event_type,
        sa.id as event_id,
        sa.quantity_change,
        sa.reason as description,
        COALESCE(u.name, 'System') as user_name,
        sa.created_at,
        0 as unit_price
      FROM stock_adjustments sa
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE sa.product_id = ?
    `).all(id) as any[];

    // 2. Sales & Refunds
    const sales = db.prepare(`
      SELECT 
        CASE WHEN s.status = 'refunded' THEN 'refund' ELSE 'sale' END as event_type,
        si.id as event_id,
        CASE WHEN s.status = 'refunded' THEN si.quantity ELSE -si.quantity END as quantity_change,
        'Sale #' || s.id || ' (' || COALESCE(s.payment_method, 'Cash') || ')' || CASE WHEN s.status = 'refunded' THEN ' [REFUNDED: ' || COALESCE(s.refund_reason, 'No reason') || ']' ELSE '' END as description,
        COALESCE(u.name, 'Cashier') as user_name,
        s.created_at,
        si.unit_price
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE si.product_id = ?
    `).all(id) as any[];

    // 3. Restocking / Purchases
    const purchases = db.prepare(`
      SELECT 
        'restock' as event_type,
        pi.id as event_id,
        pi.quantity as quantity_change,
        'Restock / Purchase from ' || COALESCE(p.supplier_name, 'Supplier') as description,
        COALESCE(u.name, 'Admin') as user_name,
        p.created_at,
        pi.unit_price
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE pi.product_id = ?
    `).all(id) as any[];

    const auditLog = [...adjustments, ...sales, ...purchases].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json(auditLog);
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

// Bulk Product Import
app.post('/api/products/bulk-import', authenticate, requireAdmin, (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'No products array provided for import' });
  }

  let importedCount = 0;
  let updatedCount = 0;

  const importTx = db.transaction((items: any[]) => {
    for (const item of items) {
      if (!item.name || item.name.trim() === '') continue;

      let sku = item.sku && item.sku.trim() ? item.sku.trim() : '';
      if (!sku) {
        let isUnique = false;
        while (!isUnique) {
          sku = 'SKU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
          const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
          if (!existing) isUnique = true;
        }
      }

      if (item.category && item.category.trim()) {
        db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(item.category.trim());
      }

      const existingProduct: any = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);

      if (existingProduct) {
        db.prepare(`
          UPDATE products SET 
            name = COALESCE(?, name),
            category = COALESCE(?, category),
            cost_price = ?,
            selling_price = ?,
            stock_quantity = stock_quantity + ?,
            barcode = COALESCE(?, barcode),
            brand = COALESCE(?, brand),
            unit_of_measure = COALESCE(?, unit_of_measure),
            min_stock_level = COALESCE(?, min_stock_level)
          WHERE id = ?
        `).run(
          item.name,
          item.category || null,
          Number(item.cost_price) || 0,
          Number(item.selling_price) || 0,
          Number(item.stock_quantity) || 0,
          item.barcode || null,
          item.brand || null,
          item.unit_of_measure || null,
          item.min_stock_level ? Number(item.min_stock_level) : null,
          existingProduct.id
        );
        updatedCount++;
      } else {
        db.prepare(`
          INSERT INTO products (name, sku, category, cost_price, selling_price, stock_quantity, barcode, brand, unit_of_measure, min_stock_level)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.name,
          sku,
          item.category || 'General',
          Number(item.cost_price) || 0,
          Number(item.selling_price) || 0,
          Number(item.stock_quantity) || 0,
          item.barcode || null,
          item.brand || null,
          item.unit_of_measure || null,
          item.min_stock_level ? Number(item.min_stock_level) : null
        );
        importedCount++;
      }
    }
  });

  try {
    importTx(products);
    res.json({ success: true, importedCount, updatedCount, totalProcessed: importedCount + updatedCount });
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
