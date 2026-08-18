import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// --- Database Setup ---
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const dbPath = isServerless 
  ? path.join('/tmp', 'retailos.db') 
  : path.join(process.cwd(), 'retailos.db');

// In serverless environments (e.g. Vercel Lambda), copy bundled DB to /tmp if present
if (isServerless) {
  try {
    const bundledDbPath = path.join(process.cwd(), 'retailos.db');
    if (!fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, dbPath);
    }
  } catch (err) {
    console.warn('Serverless database fallback initialization notice:', err);
  }
}

const db = new Database(dbPath);

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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      customer_id INTEGER,
      refund_amount REAL NOT NULL,
      refund_method TEXT NOT NULL DEFAULT 'Cash',
      return_reason TEXT NOT NULL,
      status TEXT DEFAULT 'approved',
      approved_by INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      restock_to_inventory INTEGER DEFAULT 1,
      reason TEXT,
      FOREIGN KEY (return_id) REFERENCES sales_returns(id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
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
  addColumnOrIgnore('sale_items', 'returned_quantity', 'INTEGER DEFAULT 0');
  addColumnOrIgnore('sales', 'refund_reason', 'TEXT');
  addColumnOrIgnore('purchases', 'supplier_id', 'INTEGER');
  addColumnOrIgnore('purchases', 'status', "TEXT DEFAULT 'ordered'");
  addColumnOrIgnore('purchases', 'notes', 'TEXT');
  addColumnOrIgnore('purchases', 'expected_date', 'DATETIME');
  addColumnOrIgnore('products', 'category_id', 'INTEGER');
  addColumnOrIgnore('products', 'unit_of_measure', 'TEXT');
  addColumnOrIgnore('products', 'brand', 'TEXT');
  addColumnOrIgnore('products', 'image_url', 'TEXT');
  addColumnOrIgnore('products', 'min_stock_level', 'INTEGER DEFAULT NULL');
  addColumnOrIgnore('users', 'is_active', 'INTEGER DEFAULT 1');

  // Seed default settings
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('low_stock_threshold', '10')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('audit_log_retention_days', '90')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_clear_audit_logs', 'true')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('allow_staff_stock_adjustments', 'false')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('show_staff_stock_alerts', 'true')").run();

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

    const auditCount: any = dbInstance.prepare('SELECT COUNT(*) as count FROM audit_logs').get();
    if (!auditCount || auditCount.count === 0) {
      dbInstance.prepare(`
        INSERT INTO audit_logs (user_id, user_name, action, category, details, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-2 days'))
      `).run(adminId, 'Admin User', 'User Login Successful', 'auth', 'Admin signed in from Web Dashboard');

      dbInstance.prepare(`
        INSERT INTO audit_logs (user_id, user_name, action, category, details, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-1 days'))
      `).run(adminId, 'Admin User', 'Updated System Settings', 'settings', 'Updated low stock alert threshold to 10');

      dbInstance.prepare(`
        INSERT INTO audit_logs (user_id, user_name, action, category, details, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-18 hours'))
      `).run(staffId, 'Staff User', 'Shift Opened', 'shift', 'Staff opened register with starting cash GHS 250.00');

      dbInstance.prepare(`
        INSERT INTO audit_logs (user_id, user_name, action, category, details, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-5 hours'))
      `).run(adminId, 'Admin User', 'Product Price Adjusted', 'product', 'Updated Milo 400g selling price from GHS 25.00 to GHS 28.50');

      dbInstance.prepare(`
        INSERT INTO audit_logs (user_id, user_name, action, category, details, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-1 hour'))
      `).run(staffId, 'Staff User', 'Completed POS Sale', 'sales', 'Sale #104 completed via Momo for GHS 110.00');
    }

    console.log('Demo database successfully populated!');
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

// Immediately initialize DB tables and default accounts
try {
  initDb();
} catch (e) {
  console.error('Database initialization error:', e);
}

// --- Audit & Notification Helpers ---
function logAuditEvent(userId: number | null, userName: string | null, action: string, category: string = 'general', details: string | null = null, ipAddress: string | null = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, category, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, userName || 'System', action, category, details, ipAddress);
  } catch (err) {
    console.error('Failed to write audit log event:', err);
  }
}

function createNotification(title: string, message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info', link: string | null = null) {
  try {
    const existing: any = db.prepare(`
      SELECT id FROM notifications 
      WHERE title = ? AND message = ? AND is_read = 0 AND created_at >= datetime('now', '-2 hours')
    `).get(title, message);

    if (!existing) {
      db.prepare(`
        INSERT INTO notifications (title, message, type, link)
        VALUES (?, ?, ?, ?)
      `).run(title, message, type, link);
    }
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

function runAuditLogCleanup(retentionDaysInput?: number) {
  try {
    const retentionSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'audit_log_retention_days'").get();
    const retentionDays = retentionDaysInput !== undefined ? retentionDaysInput : (retentionSetting ? parseInt(retentionSetting.value, 10) : 90);

    if (isNaN(retentionDays) || retentionDays <= 0) {
      return { success: false, clearedCount: 0, message: 'Invalid retention days value' };
    }

    const cutoffRes: any = db.prepare("SELECT datetime('now', '-' || ? || ' days') as cutoff").get(retentionDays);
    const cutoffDate = cutoffRes?.cutoff || new Date(Date.now() - retentionDays * 24 * 3600 * 1000).toISOString();

    const countBefore: any = db.prepare("SELECT COUNT(*) as cnt FROM audit_logs WHERE created_at < ?").get(cutoffDate);
    const toDeleteCount = countBefore?.cnt || 0;

    if (toDeleteCount > 0) {
      db.prepare("DELETE FROM audit_logs WHERE created_at < ?").run(cutoffDate);
    }

    logAuditEvent(
      1,
      'System Auto-Maintenance',
      'Audit Log Maintenance Performed',
      'system',
      `Cleared ${toDeleteCount} log entries older than ${retentionDays} days (cutoff date: ${cutoffDate})`
    );

    if (toDeleteCount > 0) {
      createNotification(
        'System Maintenance Executed',
        `Cleared ${toDeleteCount} audit log records older than ${retentionDays} days to keep database performance optimal.`,
        'info',
        '/audit-logs'
      );
    }

    return { success: true, clearedCount: toDeleteCount, retentionDays, cutoffDate };
  } catch (err: any) {
    console.error('Error running audit log cleanup:', err);
    return { success: false, clearedCount: 0, error: err.message };
  }
}

function checkStockAlerts() {
  try {
    const thresholdSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'low_stock_threshold'").get();
    const globalThreshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 10;

    const lowStockProducts = db.prepare(`
      SELECT id, name, sku, stock_quantity, COALESCE(min_stock_level, ?) as threshold
      FROM products
      WHERE stock_quantity <= COALESCE(min_stock_level, ?)
    `).all(globalThreshold, globalThreshold) as any[];

    for (const prod of lowStockProducts) {
      if (prod.stock_quantity <= 0) {
        createNotification(
          'Out of Stock Alert',
          `Product "${prod.name}" (SKU: ${prod.sku}) is completely OUT OF STOCK!`,
          'danger',
          `/purchases?reorder=${prod.id}`
        );
      } else {
        createNotification(
          'Low Stock Warning',
          `Product "${prod.name}" (SKU: ${prod.sku}) has reached low stock (${prod.stock_quantity} left).`,
          'warning',
          `/purchases?reorder=${prod.id}`
        );
      }
    }
  } catch (err) {
    console.error('Error checking stock alerts:', err);
  }
}

// --- App Setup ---
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_retailos_key_change_me';

app.use(cors());
app.use(express.json());

// Normalize incoming API requests (e.g. from Vercel rewrites or direct serverless routing)
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && (
    req.url.startsWith('/auth') ||
    req.url.startsWith('/products') ||
    req.url.startsWith('/sales') ||
    req.url.startsWith('/purchases') ||
    req.url.startsWith('/inventory') ||
    req.url.startsWith('/reports') ||
    req.url.startsWith('/users') ||
    req.url.startsWith('/categories') ||
    req.url.startsWith('/suppliers') ||
    req.url.startsWith('/expenses') ||
    req.url.startsWith('/shifts') ||
    req.url.startsWith('/customers') ||
    req.url.startsWith('/returns') ||
    req.url.startsWith('/settings') ||
    req.url.startsWith('/audit-logs') ||
    req.url.startsWith('/notifications') ||
    req.url.startsWith('/health') ||
    req.url.startsWith('/pos')
  )) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }
  next();
});

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

// Bulk Product Updates & Imports
app.post('/api/products/bulk-update', authenticate, requireAdmin, (req: any, res) => {
  const { updates } = req.body; // Array of product updates from CSV
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No product update records provided.' });
  }

  let updatedCount = 0;
  let priceChangeCount = 0;
  let stockAdjustmentCount = 0;
  const notFoundSkus: string[] = [];

  const runBulkUpdate = db.transaction((records) => {
    for (const record of records) {
      const identifier = record.id || record.sku || record.barcode;
      if (!identifier) continue;

      let existingProduct: any = null;
      if (record.id) {
        existingProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(record.id);
      } else if (record.sku) {
        existingProduct = db.prepare('SELECT * FROM products WHERE sku = ?').get(record.sku);
      } else if (record.barcode) {
        existingProduct = db.prepare('SELECT * FROM products WHERE barcode = ?').get(record.barcode);
      }

      if (!existingProduct && record.name) {
        existingProduct = db.prepare('SELECT * FROM products WHERE LOWER(name) = LOWER(?)').get(record.name);
      }

      if (!existingProduct) {
        if (record.sku) notFoundSkus.push(record.sku);
        continue;
      }

      const prodId = existingProduct.id;
      const oldSellingPrice = Number(existingProduct.selling_price);
      const oldCostPrice = Number(existingProduct.cost_price);
      const oldStock = Number(existingProduct.stock_quantity);

      const newCostPrice = record.cost_price !== undefined && !isNaN(Number(record.cost_price)) && Number(record.cost_price) >= 0
        ? Number(record.cost_price)
        : oldCostPrice;

      const newSellingPrice = record.selling_price !== undefined && !isNaN(Number(record.selling_price)) && Number(record.selling_price) >= 0
        ? Number(record.selling_price)
        : oldSellingPrice;

      let newStock = oldStock;
      if (record.stock_quantity !== undefined && !isNaN(Number(record.stock_quantity))) {
        newStock = Number(record.stock_quantity);
      } else if (record.stock_change !== undefined && !isNaN(Number(record.stock_change))) {
        newStock = oldStock + Number(record.stock_change);
      } else if (record.quantity_change !== undefined && !isNaN(Number(record.quantity_change))) {
        newStock = oldStock + Number(record.quantity_change);
      }

      const nameToSet = record.name && record.name.trim() !== '' ? record.name : existingProduct.name;
      const categoryToSet = record.category && record.category.trim() !== '' ? record.category : existingProduct.category;
      const barcodeToSet = record.barcode && record.barcode.trim() !== '' ? record.barcode : existingProduct.barcode;
      const brandToSet = record.brand && record.brand.trim() !== '' ? record.brand : existingProduct.brand;
      const uomToSet = record.unit_of_measure && record.unit_of_measure.trim() !== '' ? record.unit_of_measure : existingProduct.unit_of_measure;
      const minStockToSet = record.min_stock_level !== undefined && !isNaN(Number(record.min_stock_level)) ? Number(record.min_stock_level) : existingProduct.min_stock_level;

      if (oldSellingPrice !== newSellingPrice) {
        db.prepare('INSERT INTO price_history (product_id, old_selling_price, new_selling_price) VALUES (?, ?, ?)').run(
          prodId, oldSellingPrice, newSellingPrice
        );
        priceChangeCount++;
      }

      if (oldStock !== newStock) {
        const delta = newStock - oldStock;
        db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(
          prodId, req.user.id, 'Bulk CSV Inventory & Price Update', delta
        );
        stockAdjustmentCount++;
      }

      db.prepare(`
        UPDATE products 
        SET name = ?, category = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, barcode = ?, brand = ?, unit_of_measure = ?, min_stock_level = ?
        WHERE id = ?
      `).run(
        nameToSet, categoryToSet, newCostPrice, newSellingPrice, newStock, barcodeToSet, brandToSet, uomToSet, minStockToSet, prodId
      );

      updatedCount++;
    }
  });

  try {
    runBulkUpdate(updates);

    if (updatedCount > 0) {
      logAuditEvent(req.user.id, req.user.name, 'Bulk Product CSV Update', 'products', `Updated ${updatedCount} products (${priceChangeCount} price changes, ${stockAdjustmentCount} stock adjustments).`);
      createNotification('Bulk Product Update', `Manager ${req.user.name} updated ${updatedCount} products in catalog via CSV.`, 'info', '/products');
      checkStockAlerts();
    }

    res.json({
      success: true,
      updatedCount,
      priceChangeCount,
      stockAdjustmentCount,
      notFoundSkus
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/products/bulk-import', authenticate, requireAdmin, (req: any, res) => {
  const { products } = req.body;
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'No product records provided for import.' });
  }

  let importedCount = 0;
  let updatedCount = 0;

  const runBulkImport = db.transaction((items) => {
    for (let item of items) {
      let existing: any = null;
      if (item.sku) {
        existing = db.prepare('SELECT * FROM products WHERE sku = ?').get(item.sku);
      }
      if (!existing && item.barcode) {
        existing = db.prepare('SELECT * FROM products WHERE barcode = ?').get(item.barcode);
      }

      if (existing) {
        const oldSellingPrice = Number(existing.selling_price);
        const newSellingPrice = item.selling_price !== undefined ? Number(item.selling_price) : oldSellingPrice;
        if (oldSellingPrice !== newSellingPrice) {
          db.prepare('INSERT INTO price_history (product_id, old_selling_price, new_selling_price) VALUES (?, ?, ?)').run(
            existing.id, oldSellingPrice, newSellingPrice
          );
        }

        const newStock = (item.stock_quantity !== undefined ? Number(item.stock_quantity) : Number(existing.stock_quantity));
        const delta = newStock - Number(existing.stock_quantity);
        if (delta !== 0) {
          db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(
            existing.id, req.user.id, 'Bulk CSV Product Import/Update', delta
          );
        }

        db.prepare(`
          UPDATE products 
          SET name = COALESCE(?, name), category = COALESCE(?, category), cost_price = COALESCE(?, cost_price), 
              selling_price = ?, stock_quantity = ?, barcode = COALESCE(?, barcode), brand = COALESCE(?, brand), 
              unit_of_measure = COALESCE(?, unit_of_measure), min_stock_level = COALESCE(?, min_stock_level)
          WHERE id = ?
        `).run(
          item.name, item.category, item.cost_price, newSellingPrice, newStock, item.barcode, item.brand, item.unit_of_measure, item.min_stock_level, existing.id
        );
        updatedCount++;
      } else {
        let skuToUse = item.sku;
        if (!skuToUse || skuToUse.trim() === '') {
          let isUnique = false;
          while (!isUnique) {
            skuToUse = 'SKU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            const check = db.prepare('SELECT id FROM products WHERE sku = ?').get(skuToUse);
            if (!check) isUnique = true;
          }
        }

        db.prepare(`
          INSERT INTO products (name, sku, category, cost_price, selling_price, stock_quantity, barcode, brand, unit_of_measure, min_stock_level)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.name || 'Unnamed Product',
          skuToUse,
          item.category || 'General',
          item.cost_price || 0,
          item.selling_price || 0,
          item.stock_quantity || 0,
          item.barcode || null,
          item.brand || null,
          item.unit_of_measure || 'pcs',
          item.min_stock_level !== undefined ? item.min_stock_level : 10
        );
        importedCount++;
      }
    }
  });

  try {
    runBulkImport(products);

    logAuditEvent(req.user.id, req.user.name, 'Bulk Product Import', 'products', `Imported ${importedCount} new products, updated ${updatedCount} existing products.`);
    createNotification('Bulk Product Import', `Manager ${req.user.name} imported ${importedCount} new items & updated ${updatedCount} items.`, 'success', '/products');
    checkStockAlerts();

    res.json({ success: true, importedCount, updatedCount });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Inventory adjustments
app.post('/api/inventory/adjust', authenticate, (req: any, res) => {
  const { product_id, quantity_change, reason } = req.body;
  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ error: 'Reason must be at least 3 characters long' });
  }

  // Permission check: if not admin, check if staff stock adjustments are allowed by admin
  if (req.user.role !== 'admin') {
    const allowSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'allow_staff_stock_adjustments'").get();
    if (allowSetting?.value !== 'true') {
      return res.status(403).json({ error: 'Permission denied: Manual stock adjustments by staff are disabled by administrator.' });
    }
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

app.post('/api/inventory/adjust-bulk', authenticate, (req: any, res) => {
  const { adjustments, reason } = req.body; // adjustments: { product_id: number, quantity_change: number }[]
  if (!adjustments || adjustments.length === 0) return res.status(400).json({ error: 'No adjustments provided' });
  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ error: 'Reason must be at least 3 characters long' });
  }

  // Permission check: if not admin, check if staff stock adjustments are allowed by admin
  if (req.user.role !== 'admin') {
    const allowSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'allow_staff_stock_adjustments'").get();
    if (allowSetting?.value !== 'true') {
      return res.status(403).json({ error: 'Permission denied: Manual stock adjustments by staff are disabled by administrator.' });
    }
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

app.get('/api/inventory/adjustments', authenticate, (req: any, res) => {
  // Allow admin or staff (if staff adjustments are enabled)
  if (req.user.role !== 'admin') {
    const allowSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'allow_staff_stock_adjustments'").get();
    if (allowSetting?.value !== 'true') {
      return res.status(403).json({ error: 'Permission denied: Stock adjustments log is restricted to administrators.' });
    }
  }

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

    // Trigger real-time sale notification
    createNotification(
      'New Sale Completed',
      `Sale #${saleId} completed for GHS ${total_amount.toFixed(2)} (${payment_method || 'Cash'}) by ${(req as any).user.name || 'Cashier'}.`,
      'success',
      '/transactions'
    );

    // Audit log
    logAuditEvent((req as any).user.id, (req as any).user.name, 'Completed POS Sale', 'sales', `Sale #${saleId} completed for GHS ${total_amount.toFixed(2)} (${payment_method || 'Cash'})`);

    // Check low stock levels
    checkStockAlerts();

    res.json({ success: true, saleId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sales', authenticate, (req: any, res) => {
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

  // Enforce role-based security: Non-admin staff ONLY see their own sales transactions.
  // Admins can see all sales or filter by a specific staff member (userId).
  if (req.user.role !== 'admin') {
    conditions.push('sales.user_id = ?');
    params.push(req.user.id);
  } else if (userId) {
    conditions.push('sales.user_id = ?');
    params.push(userId);
  }

  if (startDate && endDate) {
    conditions.push('date(sales.created_at) >= date(?) AND date(sales.created_at) <= date(?)');
    params.push(startDate, endDate);
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

app.get('/api/sales/:id', authenticate, (req: any, res) => {
  try {
    const sale = db.prepare(`
      SELECT sales.*, users.name as user_name, customers.name as customer_name, customers.phone as customer_phone, customers.email as customer_email
      FROM sales
      JOIN users ON sales.user_id = users.id
      LEFT JOIN customers ON sales.customer_id = customers.id
      WHERE sales.id = ?
    `).get(req.params.id) as any;

    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    if (req.user.role !== 'admin' && sale.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Staff members can only view their own sales.' });
    }

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

// Purchases & Purchase Orders
app.post('/api/purchases', authenticate, (req: any, res) => {
  const { supplier_name, supplier_contact, items, status, notes, expected_date } = req.body; // items: { product_id, quantity, unit_price }[]
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items provided for purchase order' });

  const poStatus = status || 'ordered';
  const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
  
  const setupPurchase = db.transaction((purchaseItems) => {
    const purchaseResult = db.prepare('INSERT INTO purchases (user_id, supplier_name, supplier_contact, total_amount, status, notes, expected_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      req.user.id, supplier_name, supplier_contact || null, total_amount, poStatus, notes || null, expected_date || null
    );
    const purchaseId = purchaseResult.lastInsertRowid;

    for (const item of purchaseItems) {
      db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(
        purchaseId, item.product_id, item.quantity, item.unit_price
      );
      // If initialized directly as received, increase inventory immediately
      if (poStatus === 'received') {
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
      }
    }
    return purchaseId;
  });

  try {
    const purchaseId = setupPurchase(items);

    // Notify relevant managers & admins of new PO creation
    createNotification(
      'New Purchase Order Created',
      `PO #PO-${purchaseId} for "${supplier_name}" created with status "${poStatus.toUpperCase()}" (Total: GHS ${total_amount.toFixed(2)}).`,
      poStatus === 'received' ? 'success' : 'info',
      '/purchases'
    );

    logAuditEvent(
      req.user.id, 
      req.user.name, 
      'Created Purchase Order', 
      'stock', 
      `Created PO #PO-${purchaseId} for ${supplier_name} [Status: ${poStatus}, Total: GHS ${total_amount.toFixed(2)}]`
    );

    res.json({ success: true, purchaseId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchases', authenticate, (req, res) => {
  try {
    const purchases = db.prepare(`
      SELECT 
        p.*, 
        u.name as user_name,
        (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count,
        (SELECT SUM(quantity) FROM purchase_items WHERE purchase_id = p.id) as total_units
      FROM purchases p 
      LEFT JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC
    `).all();
    res.json(purchases);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/purchases/:id', authenticate, (req, res) => {
  try {
    const purchase = db.prepare(`
      SELECT p.*, u.name as user_name 
      FROM purchases p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.id = ?
    `).get(req.params.id) as any;

    if (!purchase) return res.status(404).json({ error: 'Purchase Order not found' });

    const items = db.prepare(`
      SELECT pi.*, prod.name as product_name, prod.sku, prod.category
      FROM purchase_items pi
      JOIN products prod ON pi.product_id = prod.id
      WHERE pi.purchase_id = ?
    `).all(req.params.id);

    res.json({ ...purchase, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/purchases/:id/status', authenticate, (req: any, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'submitted', 'ordered', 'received', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid purchase order status' });
  }

  try {
    const po: any = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const oldStatus = po.status || 'ordered';
    if (oldStatus === status) {
      return res.json({ success: true, message: 'Status unchanged' });
    }

    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all() as any[];

    db.transaction(() => {
      // Update status
      db.prepare('UPDATE purchases SET status = ? WHERE id = ?').run(status, req.params.id);

      // Handle inventory fulfillment on transition to received
      if (status === 'received' && oldStatus !== 'received') {
        for (const item of items) {
          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
        }
      } 
      // Handle reverting inventory if received PO is cancelled
      else if (oldStatus === 'received' && status === 'cancelled') {
        for (const item of items) {
          db.prepare('UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?').run(item.quantity, item.product_id);
        }
      }
    })();

    // Notify Managers & Admins
    const notifyType = status === 'received' ? 'success' : status === 'cancelled' ? 'danger' : 'info';
    createNotification(
      'Purchase Order Status Updated',
      `PO #PO-${po.id} for "${po.supplier_name}" status changed from "${oldStatus.toUpperCase()}" to "${status.toUpperCase()}" by ${req.user.name}.`,
      notifyType,
      '/purchases'
    );

    // Audit log
    logAuditEvent(
      req.user.id, 
      req.user.name, 
      'Updated PO Status', 
      'stock', 
      `Updated PO #PO-${po.id} status from ${oldStatus} to ${status}`
    );

    // Check stock levels in case of inventory changes
    checkStockAlerts();

    res.json({ success: true, oldStatus, newStatus: status });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reports Overview
// Reports
app.get('/api/reports/transactions', authenticate, (req: any, res) => {
  try {
    let salesQuery = `
      SELECT 'sale' as type, sales.id, total_amount as amount, sales.created_at, 'Sale #' || sales.id as description, users.name as user_name, sales.payment_method
      FROM sales
      JOIN users ON sales.user_id = users.id
    `;
    const salesParams: any[] = [];

    // If staff user (non-admin), restrict to their own sales
    if (req.user.role !== 'admin') {
      salesQuery += ' WHERE sales.user_id = ?';
      salesParams.push(req.user.id);
    }

    const sales = db.prepare(salesQuery).all(...salesParams) as any[];

    let returnsQuery = `
      SELECT 'return' as type, sr.id, -sr.refund_amount as amount, sr.created_at, 'Return #' || sr.id || ' (Sale #' || sr.sale_id || ')' as description, u.name as user_name, sr.refund_method as payment_method
      FROM sales_returns sr
      JOIN users u ON sr.user_id = u.id
    `;
    const returnsParams: any[] = [];
    if (req.user.role !== 'admin') {
      returnsQuery += ' WHERE sr.user_id = ?';
      returnsParams.push(req.user.id);
    }
    const returns = db.prepare(returnsQuery).all(...returnsParams) as any[];

    let purchases: any[] = [];
    let expenses: any[] = [];

    if (req.user.role === 'admin') {
      purchases = db.prepare(`
        SELECT 'purchase' as type, purchases.id, -total_amount as amount, purchases.created_at, 'Purchase: ' || supplier_name as description, users.name as user_name, 'Bank' as payment_method
        FROM purchases
        JOIN users ON purchases.user_id = users.id
      `).all() as any[];

      expenses = db.prepare(`
        SELECT 'expense' as type, expenses.id, -amount as amount, expense_date as created_at, 'Expense: ' || description as description, users.name as user_name, 'Cash' as payment_method
        FROM expenses
        LEFT JOIN users ON expenses.user_id = users.id
      `).all() as any[];
    }

    const transactions = [...sales, ...returns, ...purchases, ...expenses].sort((a, b) => 
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

app.get('/api/reports/staff-transactions-report', authenticate, (req: any, res) => {
  try {
    const { startDate, endDate, payment_method, period } = req.query;
    // Non-admins can only query their own ID; admins can query any staff member or default to themselves
    const targetUserId = req.user.role === 'admin' && req.query.userId ? req.query.userId : req.user.id;

    let dateCondition = '';
    const params: any[] = [targetUserId];

    if (startDate && endDate) {
      dateCondition = 'AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)';
      params.push(startDate, endDate);
    } else if (period === 'today') {
      dateCondition = "AND date(s.created_at) = date('now')";
    } else if (period === 'week') {
      dateCondition = "AND s.created_at >= date('now', '-7 days')";
    } else if (period === 'month') {
      dateCondition = "AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')";
    } else {
      // default: today
      dateCondition = "AND date(s.created_at) = date('now')";
    }

    if (payment_method && payment_method !== 'all') {
      dateCondition += ' AND s.payment_method = ?';
      params.push(payment_method);
    }

    const salesList = db.prepare(`
      SELECT 
        s.id, 
        s.total_amount, 
        s.payment_method, 
        s.status, 
        s.created_at, 
        u.name as user_name,
        c.name as customer_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count,
        (SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id) as total_items_sold
      FROM sales s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.user_id = ? ${dateCondition}
      ORDER BY s.created_at DESC
    `).all(...params) as any[];

    const totalVolume = salesList.reduce((sum, s) => sum + (s.status === 'completed' ? s.total_amount : 0), 0);
    const transactionCount = salesList.filter(s => s.status === 'completed').length;
    const avgOrderValue = transactionCount > 0 ? totalVolume / transactionCount : 0;

    const cashVolume = salesList.filter(s => s.status === 'completed' && s.payment_method === 'Cash').reduce((sum, s) => sum + s.total_amount, 0);
    const momoVolume = salesList.filter(s => s.status === 'completed' && s.payment_method === 'Mobile Money').reduce((sum, s) => sum + s.total_amount, 0);
    const cardVolume = salesList.filter(s => s.status === 'completed' && s.payment_method === 'Card').reduce((sum, s) => sum + s.total_amount, 0);

    const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(targetUserId);

    res.json({
      staffMember: targetUser,
      totalVolume,
      transactionCount,
      avgOrderValue,
      paymentBreakdown: {
        cash: cashVolume,
        mobileMoney: momoVolume,
        card: cardVolume
      },
      transactions: salesList
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
    const cats = db.prepare(`
      SELECT 
        c.*,
        p.name as parent_name,
        COALESCE(prod.product_count, 0) as product_count,
        COALESCE(prod.total_stock, 0) as total_stock,
        COALESCE(prod.total_value, 0) as total_value
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      LEFT JOIN (
        SELECT 
          category,
          COUNT(*) as product_count,
          SUM(stock_quantity) as total_stock,
          SUM(stock_quantity * selling_price) as total_value
        FROM products
        GROUP BY category
      ) prod ON c.name = prod.category
      ORDER BY c.name ASC
    `).all();
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
    if (used && used.count > 0) {
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
    const suppliers = db.prepare(`
      SELECT 
        s.*,
        COALESCE(p.total_purchases, 0) as total_purchases,
        COALESCE(p.total_spent, 0) as total_spent,
        p.last_purchase_date
      FROM suppliers_list s
      LEFT JOIN (
        SELECT 
          supplier_name,
          COUNT(*) as total_purchases,
          SUM(total_amount) as total_spent,
          MAX(created_at) as last_purchase_date
        FROM purchases
        WHERE status != 'cancelled'
        GROUP BY supplier_name
      ) p ON LOWER(s.name) = LOWER(p.supplier_name)
      ORDER BY s.name ASC
    `).all();
    res.json(suppliers);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/suppliers', authenticate, requireAdmin, (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  try {
    const result = db.prepare('INSERT INTO suppliers_list (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)').run(name, contact_person || null, email || null, phone || null, address || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/suppliers/:id', authenticate, requireAdmin, (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  try {
    db.prepare('UPDATE suppliers_list SET name = ?, contact_person = ?, email = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, contact_person || null, email || null, phone || null, address || null, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/suppliers/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const supplier = db.prepare('SELECT name FROM suppliers_list WHERE id = ?').get(req.params.id) as any;
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    const purchasesCount = db.prepare('SELECT COUNT(*) as count FROM purchases WHERE LOWER(supplier_name) = LOWER(?)').get(supplier.name) as any;
    if (purchasesCount && purchasesCount.count > 0) {
      return res.status(400).json({ error: `Cannot delete supplier "${supplier.name}" because they have ${purchasesCount.count} purchase order(s) attached.` });
    }
    db.prepare('DELETE FROM suppliers_list WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/suppliers/:id/purchases', authenticate, (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers_list WHERE id = ?').get(req.params.id) as any;
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    
    const purchases = db.prepare(`
      SELECT p.*, u.name as user_name
      FROM purchases p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE LOWER(p.supplier_name) = LOWER(?)
      ORDER BY p.created_at DESC
    `).all(supplier.name);

    res.json({ supplier, purchases });
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

// Sales Itemized Return & Refund System
app.post('/api/sales/:id/return', authenticate, (req: any, res) => {
  const saleId = req.params.id;
  const { items, refund_method, return_reason, notes } = req.body;
  // items: [{ sale_item_id, product_id, quantity, unit_price, restock_to_inventory, reason }]

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items selected for return.' });
  }

  try {
    const sale: any = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) return res.status(404).json({ error: 'Sale record not found' });

    let totalRefundAmount = 0;

    const returnTx = db.transaction(() => {
      // 1. Create sales_returns entry
      const insertReturn = db.prepare(`
        INSERT INTO sales_returns (sale_id, user_id, customer_id, refund_amount, refund_method, return_reason, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)
      `).run(
        saleId,
        req.user.id,
        sale.customer_id || null,
        0, // placeholder, updated below
        refund_method || 'Cash',
        return_reason || 'Customer Return',
        notes || null
      );

      const returnId = insertReturn.lastInsertRowid;

      for (const item of items) {
        const lineItem: any = db.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(item.sale_item_id, saleId);
        if (!lineItem) {
          throw new Error(`Sale item #${item.sale_item_id} not found on Sale #${saleId}`);
        }

        const currentReturned = lineItem.returned_quantity || 0;
        const availableToReturn = lineItem.quantity - currentReturned;

        if (item.quantity > availableToReturn) {
          throw new Error(`Cannot return ${item.quantity} units for item #${item.sale_item_id}. Max available: ${availableToReturn}`);
        }

        const itemUnitPrice = lineItem.unit_price;
        const itemRefund = item.quantity * itemUnitPrice;
        totalRefundAmount += itemRefund;

        // Insert return line item
        db.prepare(`
          INSERT INTO sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, restock_to_inventory, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnId,
          item.sale_item_id,
          item.product_id,
          item.quantity,
          itemUnitPrice,
          item.restock_to_inventory ? 1 : 0,
          item.reason || return_reason
        );

        // Update returned quantity in sale_items
        db.prepare(`
          UPDATE sale_items 
          SET returned_quantity = COALESCE(returned_quantity, 0) + ?,
              status = CASE WHEN (COALESCE(returned_quantity, 0) + ?) >= quantity THEN 'refunded' ELSE 'partially_returned' END
          WHERE id = ?
        `).run(item.quantity, item.quantity, item.sale_item_id);

        // If restock to inventory, increase stock & log adjustment
        if (item.restock_to_inventory) {
          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
          db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(
            item.product_id,
            req.user.id,
            `Customer Return Restock (Return #${returnId}, Sale #${saleId})`,
            item.quantity
          );
        } else {
          // Log waste/damaged writeoff
          db.prepare('INSERT INTO stock_adjustments (product_id, user_id, reason, quantity_change) VALUES (?, ?, ?, ?)').run(
            item.product_id,
            req.user.id,
            `Damaged Customer Return Write-off (Return #${returnId}, Sale #${saleId})`,
            0
          );
        }
      }

      // Update total refund amount on sales_returns
      db.prepare('UPDATE sales_returns SET refund_amount = ? WHERE id = ?').run(totalRefundAmount, returnId);

      // Check if all items in sale are fully returned
      const remainingItemsCount: any = db.prepare(`
        SELECT COUNT(*) as count FROM sale_items 
        WHERE sale_id = ? AND (quantity - COALESCE(returned_quantity, 0)) > 0
      `).get(saleId);

      const newSaleStatus = (remainingItemsCount?.count === 0) ? 'refunded' : 'partially_returned';
      db.prepare('UPDATE sales SET status = ?, refund_reason = ? WHERE id = ?').run(newSaleStatus, return_reason, saleId);

      // Deduct loyalty points if applicable
      if (sale.customer_id) {
        const pointsToDeduct = Math.floor(totalRefundAmount / 10);
        if (pointsToDeduct > 0) {
          db.prepare('UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?').run(pointsToDeduct, sale.customer_id);
        }
      }

      return returnId;
    });

    const returnId = returnTx();

    // Audit log & Notifications
    logAuditEvent(
      req.user.id,
      req.user.name,
      'Processed Sales Return',
      'sales',
      `Processed Return #${returnId} for Sale #${saleId} (Total Refund: GHS ${totalRefundAmount.toFixed(2)}, Method: ${refund_method})`
    );

    createNotification(
      'Sales Return Processed',
      `Return #${returnId} processed for Sale #${saleId} by ${req.user.name}. Refunded GHS ${totalRefundAmount.toFixed(2)} (${refund_method}).`,
      'info',
      '/transactions'
    );

    // Fetch full return view data for receipt printing
    const returnRecord: any = db.prepare(`
      SELECT sr.*, u.name as user_name, c.name as customer_name, c.phone as customer_phone
      FROM sales_returns sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ?
    `).get(returnId);

    const returnItemsList = db.prepare(`
      SELECT sri.*, p.name as product_name
      FROM sales_return_items sri
      JOIN products p ON sri.product_id = p.id
      WHERE sri.return_id = ?
    `).all(returnId);

    res.json({
      success: true,
      returnData: {
        ...returnRecord,
        items: returnItemsList
      }
    });

  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Legacy Quick Refund Endpoint
app.post('/api/sales/:id/refund', authenticate, (req: any, res) => {
  const saleId = req.params.id;
  const { reason } = req.body;
  
  try {
    const sale: any = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'refunded') return res.status(400).json({ error: 'Already refunded' });

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all() as any[];
    
    db.transaction(() => {
      // 1. Create full return record
      const totalRefund = sale.total_amount;
      const insertReturn = db.prepare(`
        INSERT INTO sales_returns (sale_id, user_id, customer_id, refund_amount, refund_method, return_reason, status)
        VALUES (?, ?, ?, ?, ?, ?, 'approved')
      `).run(saleId, req.user.id, sale.customer_id || null, totalRefund, sale.payment_method || 'Cash', reason || 'Full Sale Refund');

      const returnId = insertReturn.lastInsertRowid;

      for (const item of items) {
        db.prepare(`
          INSERT INTO sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, restock_to_inventory, reason)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(returnId, item.id, item.product_id, item.quantity, item.unit_price, reason || 'Full Sale Refund');

        db.prepare('UPDATE sale_items SET status = ?, returned_quantity = quantity WHERE id = ?').run('refunded', item.id);
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
      }

      db.prepare('UPDATE sales SET status = ?, refund_reason = ? WHERE id = ?').run('refunded', reason || 'Full Sale Refund', saleId);
    })();

    logAuditEvent(req.user.id, req.user.name, 'Full Sale Refund', 'sales', `Refunded Sale #${saleId} for GHS ${sale.total_amount}`);
    createNotification('Sale Refunded', `Sale #${saleId} fully refunded by ${req.user.name}.`, 'warning', '/transactions');
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List Sales Returns
app.get('/api/returns', authenticate, (req: any, res) => {
  const { startDate, endDate, userId, search } = req.query;
  let query = `
    SELECT 
      sr.*, 
      u.name as user_name,
      c.name as customer_name,
      s.payment_method as original_payment_method,
      (SELECT COUNT(*) FROM sales_return_items WHERE return_id = sr.id) as item_count,
      (SELECT SUM(quantity) FROM sales_return_items WHERE return_id = sr.id) as total_units_returned
    FROM sales_returns sr
    JOIN users u ON sr.user_id = u.id
    LEFT JOIN customers c ON sr.customer_id = c.id
    JOIN sales s ON sr.sale_id = s.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (req.user.role !== 'admin') {
    conditions.push('sr.user_id = ?');
    params.push(req.user.id);
  } else if (userId) {
    conditions.push('sr.user_id = ?');
    params.push(userId);
  }

  if (startDate && endDate) {
    conditions.push('date(sr.created_at) >= date(?) AND date(sr.created_at) <= date(?)');
    params.push(startDate, endDate);
  }

  if (search) {
    conditions.push('(sr.id LIKE ? OR sr.sale_id LIKE ? OR c.name LIKE ? OR sr.return_reason LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY sr.created_at DESC';

  try {
    const returns = db.prepare(query).all(...params);
    res.json(returns);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sales Returns Summary Analytics
app.get('/api/returns/summary', authenticate, (req: any, res) => {
  try {
    const todayReturnCount: any = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total FROM sales_returns WHERE date(created_at) = date('now')").get();
    const monthRefundValue: any = db.prepare("SELECT COALESCE(SUM(refund_amount), 0) as total FROM sales_returns WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").get();
    
    // Staff member specific returns today
    const myTodayReturns: any = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total FROM sales_returns WHERE user_id = ? AND date(created_at) = date('now')").get(req.user.id);

    // Damaged return loss
    const damagedLoss: any = db.prepare(`
      SELECT COALESCE(SUM(sri.quantity * sri.unit_price), 0) as total
      FROM sales_return_items sri
      JOIN sales_returns sr ON sri.return_id = sr.id
      WHERE sri.restock_to_inventory = 0 AND strftime('%Y-%m', sr.created_at) = strftime('%Y-%m', 'now')
    `).get();

    // Top returned products
    const topReturnedProducts = db.prepare(`
      SELECT p.name as product_name, SUM(sri.quantity) as total_qty, SUM(sri.quantity * sri.unit_price) as total_refund
      FROM sales_return_items sri
      JOIN products p ON sri.product_id = p.id
      GROUP BY sri.product_id
      ORDER BY total_qty DESC
      LIMIT 5
    `).all();

    // Return reasons breakdown
    const reasonsBreakdown = db.prepare(`
      SELECT return_reason as reason, COUNT(*) as count, SUM(refund_amount) as total
      FROM sales_returns
      GROUP BY return_reason
      ORDER BY count DESC
    `).all();

    res.json({
      todayReturnCount: todayReturnCount?.count || 0,
      todayRefundValue: todayReturnCount?.total || 0,
      monthRefundValue: monthRefundValue?.total || 0,
      damagedStockLoss: damagedLoss?.total || 0,
      myTodayReturnCount: myTodayReturns?.count || 0,
      myTodayRefundValue: myTodayReturns?.total || 0,
      topReturnedProducts,
      reasonsBreakdown
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Single Return Detail
app.get('/api/returns/:id', authenticate, (req: any, res) => {
  try {
    const returnRecord: any = db.prepare(`
      SELECT sr.*, u.name as user_name, c.name as customer_name, c.phone as customer_phone
      FROM sales_returns sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ?
    `).get(req.params.id);

    if (!returnRecord) return res.status(404).json({ error: 'Return record not found' });

    if (req.user.role !== 'admin' && returnRecord.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const items = db.prepare(`
      SELECT sri.*, p.name as product_name
      FROM sales_return_items sri
      JOIN products p ON sri.product_id = p.id
      WHERE sri.return_id = ?
    `).all(req.params.id);

    res.json({ ...returnRecord, items });
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
app.get('/api/settings', authenticate, (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const result: Record<string, string> = {};
  for (const s of settings as any[]) {
    result[s.key] = s.value;
  }
  res.json(result);
});

app.put('/api/settings', authenticate, requireAdmin, (req, res) => {
  const { low_stock_threshold, audit_log_retention_days, auto_clear_audit_logs, allow_staff_stock_adjustments, show_staff_stock_alerts } = req.body;
  if (low_stock_threshold !== undefined) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('low_stock_threshold', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(low_stock_threshold.toString(), low_stock_threshold.toString());
  }
  if (audit_log_retention_days !== undefined) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('audit_log_retention_days', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(audit_log_retention_days.toString(), audit_log_retention_days.toString());
  }
  if (auto_clear_audit_logs !== undefined) {
    const val = auto_clear_audit_logs ? 'true' : 'false';
    db.prepare("INSERT INTO settings (key, value) VALUES ('auto_clear_audit_logs', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);
  }
  if (allow_staff_stock_adjustments !== undefined) {
    const val = allow_staff_stock_adjustments ? 'true' : 'false';
    db.prepare("INSERT INTO settings (key, value) VALUES ('allow_staff_stock_adjustments', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);
  }
  if (show_staff_stock_alerts !== undefined) {
    const val = show_staff_stock_alerts ? 'true' : 'false';
    db.prepare("INSERT INTO settings (key, value) VALUES ('show_staff_stock_alerts', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);
  }

  logAuditEvent((req as any).user.id, (req as any).user.name, 'Updated System Settings', 'settings', `Updated settings: Low Stock Threshold = ${low_stock_threshold}, Retention Days = ${audit_log_retention_days}, Auto Clear = ${auto_clear_audit_logs}, Allow Staff Adjustments = ${allow_staff_stock_adjustments}, Show Staff Alerts = ${show_staff_stock_alerts}`);

  res.json({ success: true });
});

// Audit Logs API
app.get('/api/audit-logs', authenticate, requireAdmin, (req, res) => {
  const { category, user_id, search } = req.query;
  let query = "SELECT * FROM audit_logs WHERE 1=1";
  const params: any[] = [];

  if (category && category !== 'all') {
    query += " AND category = ?";
    params.push(category);
  }

  if (user_id && user_id !== 'all') {
    query += " AND user_id = ?";
    params.push(user_id);
  }

  if (search) {
    query += " AND (action LIKE ? OR details LIKE ? OR user_name LIKE ?)";
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += " ORDER BY created_at DESC LIMIT 300";

  try {
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/audit-logs/cleanup', authenticate, requireAdmin, (req, res) => {
  const { retention_days } = req.body;
  const days = retention_days ? parseInt(retention_days, 10) : undefined;
  const result = runAuditLogCleanup(days);
  res.json(result);
});

// Notifications API
app.get('/api/notifications', authenticate, (req, res) => {
  try {
    const notifications = db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50").all();
    const unreadCount: any = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0").get();
    res.json({
      notifications,
      unread_count: unreadCount?.count || 0
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', authenticate, (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/notifications/read-all', authenticate, (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE is_read = 0").run();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', authenticate, (req, res) => {
  try {
    db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/notifications/clear-all', authenticate, (req, res) => {
  try {
    db.prepare("DELETE FROM notifications WHERE is_read = 1").run();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Server Startup ---
async function startServer() {
  initDb();

  // Run stock check & auto audit log cleanup if enabled
  try {
    checkStockAlerts();
    const autoClearSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'auto_clear_audit_logs'").get();
    if (autoClearSetting?.value === 'true') {
      runAuditLogCleanup();
    }
  } catch (e) {
    console.error('Startup automated maintenance error:', e);
  }

  // Background service: Continuously monitor product stock levels every 15s
  setInterval(() => {
    try {
      checkStockAlerts();
    } catch (e) {
      console.error('Background low stock check error:', e);
    }
  }, 15000);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
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

// If running as standalone server (Node/Cloud Run), boot the dev/prod server
if (!isServerless && process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, db, initDb };
export default app;
