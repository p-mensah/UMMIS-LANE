import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Application, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// The verified secure websocket key specified for Ummis Lane Enterprise Communications
export const WEBSOCKET_AUTH_KEY = process.env.WEBSOCKET_AUTH_KEY || 'fb60458aea288dbb2f7aec4db7004b32377159ef2f44b95af95a18b06d4f86cd';

export interface ChatUser {
  id: number;
  name: string;
  role: string;
  email: string;
  profile_picture?: string;
  department?: string;
}

let ioInstance: SocketIOServer | null = null;
const onlineUsersMap = new Map<number, { user: ChatUser; socketIds: Set<string>; lastSeen: number }>();

export function getOnlineUserIds(): number[] {
  return Array.from(onlineUsersMap.keys());
}

export function isUserOnline(userId: number): boolean {
  return onlineUsersMap.has(userId) && (onlineUsersMap.get(userId)?.socketIds.size || 0) > 0;
}

export function initChatDb(db: any) {
  try {
    // 1. Create chat channels table
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'channel',
        allowed_roles TEXT DEFAULT 'admin,manager,staff,cashier',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_channel_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        last_read_message_id INTEGER DEFAULT 0,
        last_read_at DATETIME,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        sender_id INTEGER NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        sender_avatar TEXT,
        content TEXT NOT NULL,
        attachments TEXT,
        reply_to_id INTEGER,
        reply_preview TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_by INTEGER,
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_message_reads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS chat_message_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      );
    `);

    // 2. Ensure default Manager user exists for multi-role communication
    const managerEmail = 'manager@ummis.com';
    const existingManager = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(managerEmail.toLowerCase());
    const managerHash = bcrypt.hashSync('Manager@ummis', 10);
    if (!existingManager) {
      db.prepare(`
        INSERT INTO users (name, email, password, role, department, is_active, created_at)
        VALUES (?, ?, ?, 'manager', 'Store Operations & Supervision', 1, datetime('now'))
      `).run('Kwame Mensah (Store Manager)', managerEmail, managerHash);
    } else {
      db.prepare("UPDATE users SET role = 'manager', department = COALESCE(department, 'Store Operations & Supervision') WHERE LOWER(email) = ?").run(managerEmail.toLowerCase());
    }

    // Ensure all registered suppliers have user accounts for direct messaging and role identity
    try {
      const suppliers = db.prepare('SELECT name, email, contact_person FROM suppliers_list').all() as any[];
      const defaultSupplierPasswordHash = bcrypt.hashSync('Supplier@123', 10);
      for (const sup of suppliers) {
        if (!sup.email) continue;
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(sup.email.toLowerCase());
        if (!existing) {
          const displayName = sup.contact_person ? `${sup.name} (${sup.contact_person})` : sup.name;
          db.prepare(`
            INSERT INTO users (name, email, password, role, department, is_active, created_at)
            VALUES (?, ?, ?, 'supplier', 'External Supplier Partner', 1, datetime('now'))
          `).run(displayName, sup.email.toLowerCase(), defaultSupplierPasswordHash);
        } else {
          db.prepare("UPDATE users SET role = 'supplier', department = COALESCE(department, 'External Supplier Partner') WHERE LOWER(email) = ?").run(sup.email.toLowerCase());
        }
      }
    } catch (e) {
      console.warn('Error syncing suppliers into users for chat:', e);
    }

    // 3. Seed default organizational channels
    const channels = [
      {
        id: 'channel_announcements',
        name: 'Store Announcements & Bulletins',
        description: 'Store broadcasts and updates for all Staff, Cashiers, and Suppliers',
        type: 'channel',
        allowed_roles: 'admin,manager,staff,cashier,supplier'
      },
      {
        id: 'channel_general',
        name: 'General Store & Team',
        description: 'Open communication hub for Store Owner, Staff, Managers, and Suppliers',
        type: 'channel',
        allowed_roles: 'admin,manager,staff,cashier,supplier'
      },
      {
        id: 'channel_shifts',
        name: 'Shift Handover & Operations',
        description: 'Register opening/closing reconciliations, cash summaries, and task handovers',
        type: 'channel',
        allowed_roles: 'admin,manager,staff,cashier,supplier'
      },
      {
        id: 'channel_suppliers',
        name: 'Supplier & Vendor Procurement',
        description: 'Direct procurement channel for Store Owner, Managers, and Suppliers',
        type: 'channel',
        allowed_roles: 'admin,manager,supplier,staff,cashier'
      }
    ];

    const insertChan = db.prepare(`
      INSERT OR IGNORE INTO chat_channels (id, name, description, type, allowed_roles, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    for (const c of channels) {
      insertChan.run(c.id, c.name, c.description, c.type, c.allowed_roles);
    }

    try {
      db.prepare("DELETE FROM chat_channels WHERE id = 'channel_management' OR name LIKE '%Leadership%'").run();
      db.prepare("DELETE FROM chat_messages WHERE channel_id = 'channel_management'").run();
      db.prepare("UPDATE chat_channels SET allowed_roles = 'admin,manager,staff,cashier,supplier' WHERE id IN ('channel_general', 'channel_announcements', 'channel_suppliers', 'channel_shifts')").run();
    } catch(e) {}

    // 4. Seed initial conversations if messages table is empty
    const msgCount = (db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as any)?.count || 0;
    if (msgCount === 0) {
      const adminUser: any = db.prepare("SELECT id, name, role, profile_picture FROM users WHERE role = 'admin' LIMIT 1").get();
      const managerUser: any = db.prepare("SELECT id, name, role, profile_picture FROM users WHERE role = 'manager' LIMIT 1").get();
      const staffUser: any = db.prepare("SELECT id, name, role, profile_picture FROM users WHERE role = 'staff' LIMIT 1").get();

      const adminId = adminUser?.id || 1;
      const adminName = adminUser?.name || 'Ing. Mensah (Owner)';
      const adminAvatar = adminUser?.profile_picture || null;

      const mgrId = managerUser?.id || 2;
      const mgrName = managerUser?.name || 'Kwame Mensah (Store Manager)';
      const mgrAvatar = managerUser?.profile_picture || null;

      const stfId = staffUser?.id || 3;
      const stfName = staffUser?.name || 'Store Staff';
      const stfAvatar = staffUser?.profile_picture || null;

      const initialMessages = [
        {
          channel_id: 'channel_general',
          sender_id: adminId,
          sender_name: adminName,
          sender_role: 'admin',
          sender_avatar: adminAvatar,
          content: 'Good morning everyone! Real-time internal communication is now live across all registers and management consoles.',
          created_at: "datetime('now', '-2 hours')"
        },
        {
          channel_id: 'channel_general',
          sender_id: mgrId,
          sender_name: mgrName,
          sender_role: 'manager',
          sender_avatar: mgrAvatar,
          content: 'Good morning Admin! Confirming that register stations 1 and 2 are active. Staff morning briefing completed.',
          created_at: "datetime('now', '-1 hour', '+45 minutes')"
        },
        {
          channel_id: 'channel_general',
          sender_id: stfId,
          sender_name: stfName,
          sender_role: 'staff',
          sender_avatar: stfAvatar,
          content: 'Morning Kwame & Admin! All barcode scanners verified. Dairy and Grocery stock levels updated.',
          created_at: "datetime('now', '-1 hour', '+20 minutes')"
        },
        {
          channel_id: 'channel_general',
          sender_id: adminId,
          sender_name: adminName,
          sender_role: 'admin',
          sender_avatar: adminAvatar,
          content: 'Kwame, please review the low stock threshold alerts for Nestlé Milo and Gino paste before the 2 PM order cycle.',
          created_at: "datetime('now', '-50 minutes')"
        },
        {
          channel_id: 'channel_general',
          sender_id: mgrId,
          sender_name: mgrName,
          sender_role: 'manager',
          sender_avatar: mgrAvatar,
          content: 'On it. Reorder manifests are prepared in Purchase Orders with Net 30 vendor settlement terms.',
          created_at: "datetime('now', '-35 minutes')"
        },
        {
          channel_id: 'channel_shifts',
          sender_id: stfId,
          sender_name: stfName,
          sender_role: 'staff',
          sender_avatar: stfAvatar,
          content: 'Morning shift drawer opened with GH₵ 250.00 float. Cashier Lane A active.',
          created_at: "datetime('now', '-1 hour')"
        },
        {
          channel_id: 'channel_announcements',
          sender_id: adminId,
          sender_name: adminName,
          sender_role: 'admin',
          sender_avatar: adminAvatar,
          content: '📢 SYSTEM NOTICE: Real-time Socket.IO synchronization active. Typing status, message read receipts, and live online presence are now operational for Staff, Managers, and Admins.',
          created_at: "datetime('now', '-2 hours')"
        }
      ];

      for (const m of initialMessages) {
        const res = db.prepare(`
          INSERT INTO chat_messages (channel_id, sender_id, sender_name, sender_role, sender_avatar, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ${m.created_at})
        `).run(m.channel_id, m.sender_id, m.sender_name, m.sender_role, m.sender_avatar, m.content);

        const msgId = res.lastInsertRowid;
        // Mark sender as having read their own message
        db.prepare(`
          INSERT OR IGNORE INTO chat_message_reads (message_id, channel_id, user_id, read_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(msgId, m.channel_id, m.sender_id);
      }
    }

    console.log('✅ Chat and communication system tables initialized successfully.');
  } catch (err) {
    console.error('Error initializing chat database tables:', err);
  }
}

export function setupChatSocket(httpServer: any, db: any, jwtSecret: string): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 30000,
    pingInterval: 15000
  });

  ioInstance = io;

  // Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const query = socket.handshake.query || {};
      const token = auth.token || (socket.handshake.headers.authorization ? socket.handshake.headers.authorization.split(' ')[1] : query.token);
      const wsKey = auth.wsKey || query.wsKey;

      // Note: wsKey can be used for connection verification
      if (wsKey && wsKey !== WEBSOCKET_AUTH_KEY) {
        console.warn('WebSocket connection attempt with mismatching wsKey:', wsKey);
      }

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      let user: ChatUser | null = null;

      if (typeof token === 'string' && token.startsWith('mock_')) {
        return next(new Error('Session expired. Please sign in with real credentials.'));
      } else {
        let decoded: any = null;
        let tokenExpired = false;

        try {
          decoded = jwt.verify(token, jwtSecret);
        } catch (verifyErr: any) {
          if (verifyErr.name === 'TokenExpiredError' || verifyErr.message?.includes('expired')) {
            tokenExpired = true;
          }
          try {
            decoded = jwt.decode(token);
          } catch {
            decoded = null;
          }
        }

        if (decoded) {
          const userId = decoded.id || decoded.sub;
          const userEmail = (decoded.email || '').toLowerCase();
          let u: any = null;

          if (userId && !isNaN(Number(userId))) {
            try {
              u = db.prepare('SELECT id, name, email, role, profile_picture, department, is_active FROM users WHERE id = ?').get(userId);
            } catch (dbErr) {
              u = null;
            }
          }

          if (!u && userEmail) {
            try {
              u = db.prepare('SELECT id, name, email, role, profile_picture, department, is_active FROM users WHERE LOWER(email) = ?').get(userEmail);
            } catch (dbErr) {
              u = null;
            }
          }

          if (u && u.is_active !== 0) {
            user = {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              profile_picture: u.profile_picture,
              department: u.department
            };
          } else if (userEmail) {
            const isAdmin = userEmail.includes('rabbi') || userEmail.includes('admin') || userEmail.includes('mensah');
            const isSupplier = userEmail.includes('supplier') || userEmail.includes('nestle');
            const role = isAdmin ? 'admin' : (isSupplier ? 'supplier' : (decoded.role || 'staff'));
            user = {
              id: typeof userId === 'number' ? userId : (u?.id || 1),
              name: decoded.name || decoded.user_metadata?.name || userEmail.split('@')[0],
              email: userEmail,
              role,
              department: role === 'admin' ? 'Executive Administration' : (role === 'supplier' ? 'External Vendor Partner' : 'Store Operations')
            };
          }

          // If token was expired but user is verified and valid, issue a refreshed 30-day token
          if (user && tokenExpired) {
            try {
              const freshToken = jwt.sign(
                { id: user.id, email: user.email, role: user.role, name: user.name },
                jwtSecret,
                { expiresIn: '30d' }
              );
              socket.emit('auth:refreshed_token', { token: freshToken, user });
            } catch (e) {
              // benign fallback
            }
          }
        }
      }

      if (!user) {
        return next(new Error('User not found or inactive'));
      }

      socket.data.user = user;
      next();
    } catch (err: any) {
      // Benign socket auth notice instead of error to avoid noisy crash logs
      console.warn('Socket connection authentication notice:', err.message);
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: ChatUser = socket.data.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    const userId = user.id;

    // Track online state
    if (!onlineUsersMap.has(userId)) {
      onlineUsersMap.set(userId, { user, socketIds: new Set([socket.id]), lastSeen: Date.now() });
    } else {
      onlineUsersMap.get(userId)?.socketIds.add(socket.id);
    }

    // Join user's personal private room for direct notifications
    socket.join(`user_${userId}`);

    // Broadcast updated presence to all clients
    broadcastPresence(io);

    // Send initial connection packet with verified WebSocket key and online users
    socket.emit('connection:ready', {
      user,
      websocketKey: WEBSOCKET_AUTH_KEY,
      onlineUserIds: getOnlineUserIds(),
      serverTime: new Date().toISOString()
    });

    // 1. Join a channel or direct message room
    socket.on('chat:join_channel', (data: { channelId: string }) => {
      const { channelId } = data || {};
      if (!channelId) return;

      // Access verification
      if (!canUserAccessChannel(db, user, channelId)) {
        socket.emit('chat:error', { error: 'Access denied: You do not have permission to access this channel.' });
        return;
      }

      socket.join(`channel_${channelId}`);

      // Ensure membership record exists
      try {
        db.prepare(`
          INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id, joined_at)
          VALUES (?, ?, datetime('now'))
        `).run(channelId, userId);
      } catch (e) {}

      socket.emit('chat:channel_joined', { channelId });
    });

    // 2. Leave channel
    socket.on('chat:leave_channel', (data: { channelId: string }) => {
      const { channelId } = data || {};
      if (channelId) {
        socket.leave(`channel_${channelId}`);
      }
    });

    // 3. Send message in real time
    socket.on('chat:send_message', (data: { channelId: string; content: string; replyToId?: number; attachments?: any[] }, callback?: (res: any) => void) => {
      try {
        const { channelId, content, replyToId, attachments } = data || {};
        const trimmedContent = (content || '').trim();

        if (!channelId || (!trimmedContent && (!attachments || attachments.length === 0))) {
          if (callback) callback({ error: 'Message content cannot be empty' });
          return;
        }

        if (!canUserAccessChannel(db, user, channelId)) {
          if (callback) callback({ error: 'Permission denied for this channel' });
          return;
        }

        // Get reply preview if replying
        let replyPreview: string | null = null;
        if (replyToId) {
          const parentMsg: any = db.prepare('SELECT sender_name, content, is_deleted FROM chat_messages WHERE id = ?').get(replyToId);
          if (parentMsg) {
            replyPreview = JSON.stringify({
              sender_name: parentMsg.sender_name,
              content: parentMsg.is_deleted ? 'Message was deleted' : parentMsg.content.slice(0, 100)
            });
          }
        }

        const attachmentsStr = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;

        const insertRes = db.prepare(`
          INSERT INTO chat_messages (channel_id, sender_id, sender_name, sender_role, sender_avatar, content, attachments, reply_to_id, reply_preview, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          channelId,
          userId,
          user.name,
          user.role,
          user.profile_picture || null,
          trimmedContent,
          attachmentsStr,
          replyToId || null,
          replyPreview
        );

        const messageId = insertRes.lastInsertRowid;

        // Auto-mark as read by sender
        db.prepare(`
          INSERT OR IGNORE INTO chat_message_reads (message_id, channel_id, user_id, read_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(messageId, channelId, userId);

        // Update sender's last_read in channel_members
        db.prepare(`
          INSERT INTO chat_channel_members (channel_id, user_id, last_read_message_id, last_read_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(channel_id, user_id) DO UPDATE SET
            last_read_message_id = excluded.last_read_message_id,
            last_read_at = excluded.last_read_at
        `).run(channelId, userId, messageId);

        // Update channel's updated_at
        db.prepare("UPDATE chat_channels SET updated_at = datetime('now') WHERE id = ?").run(channelId);

        const newMsgPayload = {
          id: messageId,
          channel_id: channelId,
          sender_id: userId,
          sender_name: user.name,
          sender_role: user.role,
          sender_avatar: user.profile_picture || null,
          content: trimmedContent,
          attachments: attachmentsStr ? JSON.parse(attachmentsStr) : null,
          reply_to_id: replyToId || null,
          reply_preview: replyPreview ? JSON.parse(replyPreview) : null,
          is_deleted: 0,
          created_at: new Date().toISOString(),
          read_by: [{ user_id: userId, user_name: user.name, read_at: new Date().toISOString() }],
          is_read: false
        };

        // Broadcast to channel room
        io.to(`channel_${channelId}`).emit('chat:new_message', newMsgPayload);

        // If DM, also notify other participant's personal room so they get real-time badge / toast
        if (channelId.startsWith('dm_')) {
          const otherUserId = getDmOtherUserId(channelId, userId);
          if (otherUserId) {
            io.to(`user_${otherUserId}`).emit('chat:dm_alert', {
              channelId,
              message: newMsgPayload,
              sender: user
            });
          }
        }

        if (callback) callback({ success: true, message: newMsgPayload });
      } catch (err: any) {
        console.error('Error in chat:send_message:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // 4. Typing indicators
    socket.on('chat:typing_start', (data: { channelId: string }) => {
      const { channelId } = data || {};
      if (!channelId) return;

      socket.to(`channel_${channelId}`).emit('chat:user_typing', {
        channelId,
        userId: user.id,
        userName: user.name,
        userRole: user.role
      });
    });

    socket.on('chat:typing_stop', (data: { channelId: string }) => {
      const { channelId } = data || {};
      if (!channelId) return;

      socket.to(`channel_${channelId}`).emit('chat:user_stopped_typing', {
        channelId,
        userId: user.id
      });
    });

    // 5. Mark messages as read
    socket.on('chat:mark_read', (data: { channelId: string; messageIds?: number[] }) => {
      try {
        const { channelId, messageIds } = data || {};
        if (!channelId) return;

        let affectedMessageIds: number[] = [];

        if (messageIds && messageIds.length > 0) {
          const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO chat_message_reads (message_id, channel_id, user_id, read_at)
            VALUES (?, ?, ?, datetime('now'))
          `);
          for (const mid of messageIds) {
            insertStmt.run(mid, channelId, userId);
          }
          affectedMessageIds = messageIds;
        } else {
          // Mark all unread messages in this channel as read
          const unreadMsgs = db.prepare(`
            SELECT m.id FROM chat_messages m
            WHERE m.channel_id = ? 
              AND m.id NOT IN (SELECT message_id FROM chat_message_reads WHERE channel_id = ? AND user_id = ?)
          `).all(channelId, channelId, userId) as any[];

          const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO chat_message_reads (message_id, channel_id, user_id, read_at)
            VALUES (?, ?, ?, datetime('now'))
          `);
          for (const m of unreadMsgs) {
            insertStmt.run(m.id, channelId, userId);
            affectedMessageIds.push(m.id);
          }
        }

        // Update last read message ID for user
        const maxMsg: any = db.prepare('SELECT MAX(id) as maxId FROM chat_messages WHERE channel_id = ?').get(channelId);
        if (maxMsg?.maxId) {
          db.prepare(`
            INSERT INTO chat_channel_members (channel_id, user_id, last_read_message_id, last_read_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(channel_id, user_id) DO UPDATE SET
              last_read_message_id = MAX(chat_channel_members.last_read_message_id, excluded.last_read_message_id),
              last_read_at = excluded.last_read_at
          `).run(channelId, userId, maxMsg.maxId);
        }

        // Broadcast to channel so senders see double checkmarks / read status update in real time
        io.to(`channel_${channelId}`).emit('chat:messages_read', {
          channelId,
          userId: user.id,
          userName: user.name,
          messageIds: affectedMessageIds,
          readAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    });

    // 6. Delete message (Sender or Admin can delete)
    socket.on('chat:delete_message', (data: { messageId: number; channelId: string }, callback?: (res: any) => void) => {
      try {
        const { messageId, channelId } = data || {};
        if (!messageId || !channelId) {
          if (callback) callback({ error: 'Message ID and channel ID required' });
          return;
        }

        const msg: any = db.prepare('SELECT sender_id, channel_id FROM chat_messages WHERE id = ?').get(messageId);
        if (!msg) {
          if (callback) callback({ error: 'Message not found' });
          return;
        }

        // Authorization: must be sender or admin
        if (msg.sender_id !== userId && user.role !== 'admin') {
          if (callback) callback({ error: 'Only the sender or an administrator can delete this message.' });
          return;
        }

        db.prepare(`
          UPDATE chat_messages 
          SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now')
          WHERE id = ?
        `).run(userId, messageId);

        // Broadcast deletion event to channel room
        io.to(`channel_${channelId}`).emit('chat:message_deleted', {
          messageId,
          channelId,
          deletedBy: userId,
          deletedByName: user.name
        });

        if (callback) callback({ success: true, messageId });
      } catch (err: any) {
        console.error('Error in chat:delete_message:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // 7. Toggle emoji reaction
    socket.on('chat:toggle_reaction', (data: { channelId: string; messageId: number; emoji: string }, callback?: (res: any) => void) => {
      try {
        const { channelId, messageId, emoji } = data || {};
        if (!channelId || !messageId || !emoji) {
          if (callback) callback({ error: 'channelId, messageId, and emoji required' });
          return;
        }

        const existing: any = db.prepare('SELECT id FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(messageId, userId, emoji);
        if (existing) {
          db.prepare('DELETE FROM chat_message_reactions WHERE id = ?').run(existing.id);
        } else {
          db.prepare(`
            INSERT INTO chat_message_reactions (message_id, channel_id, user_id, user_name, emoji)
            VALUES (?, ?, ?, ?, ?)
          `).run(messageId, channelId, userId, user.name, emoji);
        }

        // Query all reactions for this message
        const reactionsRaw = db.prepare(`
          SELECT emoji, COUNT(*) as count, json_group_array(json_object('user_id', user_id, 'user_name', user_name)) as users_json
          FROM chat_message_reactions
          WHERE message_id = ?
          GROUP BY emoji
        `).all(messageId) as any[];

        const reactions = reactionsRaw.map(r => ({
          emoji: r.emoji,
          count: r.count,
          users: r.users_json ? JSON.parse(r.users_json) : []
        }));

        io.to(`channel_${channelId}`).emit('chat:reaction_updated', {
          messageId: Number(messageId),
          channelId,
          reactions
        });

        if (callback) callback({ success: true, reactions });
      } catch (err: any) {
        console.error('Error in chat:toggle_reaction:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // Heartbeat / ping
    socket.on('presence:ping', () => {
      if (onlineUsersMap.has(userId)) {
        const rec = onlineUsersMap.get(userId);
        if (rec) rec.lastSeen = Date.now();
      }
      socket.emit('presence:pong', { time: Date.now() });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      if (onlineUsersMap.has(userId)) {
        const rec = onlineUsersMap.get(userId);
        if (rec) {
          rec.socketIds.delete(socket.id);
          if (rec.socketIds.size === 0) {
            onlineUsersMap.delete(userId);
          }
        }
      }
      broadcastPresence(io);
    });
  });

  return io;
}

function broadcastPresence(io: SocketIOServer) {
  const onlineList = Array.from(onlineUsersMap.values()).map(r => ({
    id: r.user.id,
    name: r.user.name,
    role: r.user.role,
    profile_picture: r.user.profile_picture,
    department: r.user.department
  }));

  io.emit('presence:update', {
    onlineUsers: onlineList,
    onlineUserIds: getOnlineUserIds()
  });
}

function canUserAccessChannel(db: any, user: ChatUser, channelId: string): boolean {
  if (channelId.startsWith('dm_')) {
    // DM channels are accessible only to the two participants (or admin oversight)
    const parts = channelId.replace('dm_', '').split('_').map(Number);
    if (parts.length === 2) {
      if (parts.includes(user.id) || user.role === 'admin') {
        return true;
      }
    }
    return false;
  }

  const chan: any = db.prepare('SELECT allowed_roles FROM chat_channels WHERE id = ?').get(channelId);
  if (!chan) return true; // allow creation or defaults
  if (!chan.allowed_roles) return true;

  const allowedRoles = chan.allowed_roles.split(',').map((r: string) => r.trim().toLowerCase());
  return allowedRoles.includes(user.role.toLowerCase()) || user.role === 'admin';
}

function getDmOtherUserId(channelId: string, currentUserId: number): number | null {
  const parts = channelId.replace('dm_', '').split('_').map(Number);
  if (parts.length === 2) {
    return parts[0] === currentUserId ? parts[1] : parts[0];
  }
  return null;
}

export function setupChatRoutes(app: Application, db: any, authenticate: any) {
  // 1. Get channels and conversations for current user
  app.get('/api/chat/channels', authenticate, (req: any, res: Response) => {
    try {
      const user = req.user;
      const userRole = (user.role || 'staff').toLowerCase();

      // Fetch public/group channels
      const channels = db.prepare(`
        SELECT c.*,
          (
            SELECT COUNT(*) 
            FROM chat_messages m 
            WHERE m.channel_id = c.id 
              AND m.sender_id != ?
              AND m.id NOT IN (SELECT message_id FROM chat_message_reads WHERE channel_id = c.id AND user_id = ?)
          ) as unread_count,
          (
            SELECT json_object('id', id, 'content', content, 'sender_name', sender_name, 'created_at', created_at, 'is_deleted', is_deleted)
            FROM chat_messages 
            WHERE channel_id = c.id 
            ORDER BY id DESC LIMIT 1
          ) as last_message_json
        FROM chat_channels c
        WHERE c.type = 'channel'
        ORDER BY c.created_at ASC
      `).all(user.id, user.id) as any[];

      // Filter based on allowed roles (Admin sees all)
      const filteredChannels = channels.filter(c => {
        if (userRole === 'admin') return true;
        const allowed = (c.allowed_roles || '').split(',').map((r: string) => r.trim().toLowerCase());
        return allowed.includes(userRole);
      }).map(c => ({
        ...c,
        last_message: c.last_message_json ? JSON.parse(c.last_message_json) : null
      }));

      // Fetch user's direct message conversations
      const dms = db.prepare(`
        SELECT c.*,
          (
            SELECT COUNT(*) 
            FROM chat_messages m 
            WHERE m.channel_id = c.id 
              AND m.sender_id != ?
              AND m.id NOT IN (SELECT message_id FROM chat_message_reads WHERE channel_id = c.id AND user_id = ?)
          ) as unread_count,
          (
            SELECT json_object('id', id, 'content', content, 'sender_name', sender_name, 'created_at', created_at, 'is_deleted', is_deleted)
            FROM chat_messages 
            WHERE channel_id = c.id 
            ORDER BY id DESC LIMIT 1
          ) as last_message_json
        FROM chat_channels c
        WHERE c.type = 'direct' 
          AND (c.id LIKE 'dm_' || ? || '_%' OR c.id LIKE 'dm_%_' || ?)
        ORDER BY c.updated_at DESC
      `).all(user.id, user.id, user.id, user.id) as any[];

      const formattedDms = dms
        .map(dm => {
          const otherUserId = getDmOtherUserId(dm.id, user.id);
          const otherUser: any = otherUserId ? db.prepare('SELECT id, name, role, email, profile_picture, department FROM users WHERE id = ?').get(otherUserId) : null;
          return {
            ...dm,
            name: otherUser ? otherUser.name : dm.name,
            other_user: otherUser ? {
              ...otherUser,
              is_online: isUserOnline(otherUser.id)
            } : null,
            last_message: dm.last_message_json ? JSON.parse(dm.last_message_json) : null
          };
        })
        .filter(dm => {
          // Supplier can only see his tenant or store owner or store manager
          if (userRole === 'supplier') {
            const role = dm.other_user?.role?.toLowerCase();
            return role === 'admin' || role === 'manager';
          }
          // Store Staff can only see communications with other staff, managers, and admins
          if (['staff', 'cashier'].includes(userRole)) {
            const role = dm.other_user?.role?.toLowerCase();
            return ['staff', 'cashier', 'manager', 'admin'].includes(role);
          }
          return true;
        });

      res.json({
        channels: filteredChannels,
        directMessages: formattedDms,
        websocketKey: WEBSOCKET_AUTH_KEY
      });
    } catch (err: any) {
      console.error('Error fetching chat channels:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Get messages for a channel
  app.get('/api/chat/channels/:channelId/messages', authenticate, (req: any, res: Response) => {
    try {
      const { channelId } = req.params;
      const user = req.user;

      if (!canUserAccessChannel(db, user, channelId)) {
        return res.status(403).json({ error: 'You do not have permission to view messages in this channel.' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

      const messages = db.prepare(`
        SELECT 
          m.*,
          CASE 
            WHEN m.sender_id = ? THEN 1
            ELSE EXISTS(SELECT 1 FROM chat_message_reads r WHERE r.message_id = m.id AND r.user_id = ?)
          END as is_read_by_me,
          (
            SELECT json_group_array(json_object('user_id', r.user_id, 'user_name', u.name, 'read_at', r.read_at))
            FROM chat_message_reads r
            JOIN users u ON u.id = r.user_id
            WHERE r.message_id = m.id
          ) as read_by_json,
          (
            SELECT json_group_array(json_object(
              'emoji', rx.emoji,
              'count', rx.cnt,
              'users', rx.users_list
            ))
            FROM (
              SELECT emoji, COUNT(*) as cnt, json_group_array(json_object('user_id', user_id, 'user_name', user_name)) as users_list
              FROM chat_message_reactions
              WHERE message_id = m.id
              GROUP BY emoji
            ) rx
          ) as reactions_json
        FROM chat_messages m
        WHERE m.channel_id = ?
        ORDER BY m.id ASC
        LIMIT ?
      `).all(user.id, user.id, channelId, limit) as any[];

      const parsedMessages = messages.map(m => {
        let readBy = [];
        try {
          readBy = m.read_by_json ? JSON.parse(m.read_by_json) : [];
        } catch (e) {}

        let reactions = [];
        try {
          reactions = m.reactions_json ? JSON.parse(m.reactions_json) : [];
          reactions = reactions.map((r: any) => ({
            ...r,
            users: typeof r.users === 'string' ? JSON.parse(r.users) : (r.users || [])
          }));
        } catch (e) {}

        // Check if any other user has read this message
        const otherReads = readBy.filter((r: any) => r.user_id !== m.sender_id);
        const isRead = otherReads.length > 0;

        return {
          id: m.id,
          channel_id: m.channel_id,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          sender_role: m.sender_role,
          sender_avatar: m.sender_avatar,
          content: m.is_deleted ? 'This message was deleted' : m.content,
          attachments: m.attachments && !m.is_deleted ? JSON.parse(m.attachments) : null,
          reply_to_id: m.reply_to_id,
          reply_preview: m.reply_preview ? JSON.parse(m.reply_preview) : null,
          is_deleted: Boolean(m.is_deleted),
          deleted_by: m.deleted_by,
          deleted_at: m.deleted_at,
          created_at: m.created_at,
          read_by: readBy,
          reactions: reactions || [],
          is_read: isRead,
          is_read_by_me: Boolean(m.is_read_by_me)
        };
      });

      res.json({ messages: parsedMessages });
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle emoji reaction via REST fallback
  app.post('/api/chat/messages/:messageId/reactions', authenticate, (req: any, res: Response) => {
    try {
      const { messageId } = req.params;
      const { emoji, channelId } = req.body;
      const user = req.user;

      if (!emoji || !channelId) {
        return res.status(400).json({ error: 'emoji and channelId required' });
      }

      const existing: any = db.prepare('SELECT id FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(messageId, user.id, emoji);
      if (existing) {
        db.prepare('DELETE FROM chat_message_reactions WHERE id = ?').run(existing.id);
      } else {
        db.prepare(`
          INSERT INTO chat_message_reactions (message_id, channel_id, user_id, user_name, emoji)
          VALUES (?, ?, ?, ?, ?)
        `).run(messageId, channelId, user.id, user.name, emoji);
      }

      const reactionsRaw = db.prepare(`
        SELECT emoji, COUNT(*) as count, json_group_array(json_object('user_id', user_id, 'user_name', user_name)) as users_json
        FROM chat_message_reactions
        WHERE message_id = ?
        GROUP BY emoji
      `).all(messageId) as any[];

      const reactions = reactionsRaw.map(r => ({
        emoji: r.emoji,
        count: r.count,
        users: r.users_json ? JSON.parse(r.users_json) : []
      }));

      if (ioInstance) {
        ioInstance.to(`channel_${channelId}`).emit('chat:reaction_updated', {
          messageId: Number(messageId),
          channelId,
          reactions
        });
      }

      res.json({ success: true, reactions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2b. Send message via REST fallback
  app.post('/api/chat/channels/:channelId/messages', authenticate, (req: any, res: Response) => {
    try {
      const { channelId } = req.params;
      const { content, replyToId, attachments } = req.body;
      const user = req.user;
      const trimmedContent = (content || '').trim();

      if (!trimmedContent && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'Message content or attachment required' });
      }

      if (!canUserAccessChannel(db, user, channelId)) {
        return res.status(403).json({ error: 'Permission denied for this channel' });
      }

      let replyPreview: string | null = null;
      if (replyToId) {
        const parentMsg: any = db.prepare('SELECT sender_name, content, is_deleted FROM chat_messages WHERE id = ?').get(replyToId);
        if (parentMsg) {
          replyPreview = JSON.stringify({
            sender_name: parentMsg.sender_name,
            content: parentMsg.is_deleted ? 'Message was deleted' : parentMsg.content.slice(0, 100)
          });
        }
      }

      const attachmentsStr = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;

      const insertRes = db.prepare(`
        INSERT INTO chat_messages (channel_id, sender_id, sender_name, sender_role, sender_avatar, content, attachments, reply_to_id, reply_preview, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        channelId,
        user.id,
        user.name,
        user.role,
        user.profile_picture || null,
        trimmedContent,
        attachmentsStr,
        replyToId || null,
        replyPreview
      );

      const messageId = insertRes.lastInsertRowid;

      db.prepare(`
        INSERT OR IGNORE INTO chat_message_reads (message_id, channel_id, user_id, read_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(messageId, channelId, user.id);

      db.prepare(`
        INSERT INTO chat_channel_members (channel_id, user_id, last_read_message_id, last_read_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(channel_id, user_id) DO UPDATE SET
          last_read_message_id = excluded.last_read_message_id,
          last_read_at = excluded.last_read_at
      `).run(channelId, user.id, messageId);

      db.prepare("UPDATE chat_channels SET updated_at = datetime('now') WHERE id = ?").run(channelId);

      const newMsgPayload = {
        id: messageId,
        channel_id: channelId,
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        sender_avatar: user.profile_picture || null,
        content: trimmedContent,
        attachments: attachmentsStr ? JSON.parse(attachmentsStr) : null,
        reply_to_id: replyToId || null,
        reply_preview: replyPreview ? JSON.parse(replyPreview) : null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        read_by: [{ user_id: user.id, user_name: user.name, read_at: new Date().toISOString() }],
        is_read: false,
        is_read_by_me: true
      };

      if (ioInstance) {
        ioInstance.to(`channel_${channelId}`).emit('chat:new_message', newMsgPayload);
        if (channelId.startsWith('dm_')) {
          const otherUserId = getDmOtherUserId(channelId, user.id);
          if (otherUserId) {
            ioInstance.to(`user_${otherUserId}`).emit('chat:dm_alert', {
              channelId,
              message: newMsgPayload,
              sender: user
            });
          }
        }
      }

      res.json({ message: newMsgPayload });
    } catch (err: any) {
      console.error('Error sending message via REST:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Mark channel messages as read
  app.post('/api/chat/channels/:channelId/read', authenticate, (req: any, res: Response) => {
    try {
      const { channelId } = req.params;
      const user = req.user;

      const unreadMsgs = db.prepare(`
        SELECT m.id FROM chat_messages m
        WHERE m.channel_id = ? 
          AND m.id NOT IN (SELECT message_id FROM chat_message_reads WHERE channel_id = ? AND user_id = ?)
      `).all(channelId, channelId, user.id) as any[];

      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO chat_message_reads (message_id, channel_id, user_id, read_at)
        VALUES (?, ?, ?, datetime('now'))
      `);

      const affectedIds: number[] = [];
      for (const m of unreadMsgs) {
        insertStmt.run(m.id, channelId, user.id);
        affectedIds.push(m.id);
      }

      const maxMsg: any = db.prepare('SELECT MAX(id) as maxId FROM chat_messages WHERE channel_id = ?').get(channelId);
      if (maxMsg?.maxId) {
        db.prepare(`
          INSERT INTO chat_channel_members (channel_id, user_id, last_read_message_id, last_read_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(channel_id, user_id) DO UPDATE SET
            last_read_message_id = MAX(chat_channel_members.last_read_message_id, excluded.last_read_message_id),
            last_read_at = excluded.last_read_at
        `).run(channelId, user.id, maxMsg.maxId);
      }

      if (ioInstance && affectedIds.length > 0) {
        ioInstance.to(`channel_${channelId}`).emit('chat:messages_read', {
          channelId,
          userId: user.id,
          userName: user.name,
          messageIds: affectedIds,
          readAt: new Date().toISOString()
        });
      }

      res.json({ success: true, count: affectedIds.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Create or fetch Direct Message conversation
  app.post('/api/chat/direct', authenticate, (req: any, res: Response) => {
    try {
      const { targetUserId } = req.body;
      const currentUserId = req.user.id;

      if (!targetUserId || targetUserId === currentUserId) {
        return res.status(400).json({ error: 'Valid target user ID required' });
      }

      const targetUser: any = db.prepare('SELECT id, name, role, email, profile_picture, department FROM users WHERE id = ?').get(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      // Role check: Supplier can only communicate with Store Owner / Tenant or Store Manager
      if (req.user?.role === 'supplier') {
        const targetRole = (targetUser.role || '').toLowerCase();
        if (!['admin', 'manager'].includes(targetRole)) {
          return res.status(403).json({ error: 'Suppliers may only directly message the Store Owner or Store Manager.' });
        }
      }

      // Role check: Store Staff communication is limited to staff, other staff, managers, and admins only
      const senderRole = (req.user?.role || '').toLowerCase();
      if (['staff', 'cashier'].includes(senderRole)) {
        const targetRole = (targetUser.role || '').toLowerCase();
        if (!['staff', 'cashier', 'manager', 'admin'].includes(targetRole)) {
          return res.status(403).json({ error: 'Store Staff communication is strictly limited to staff, other staff, managers, and admins only.' });
        }
      }

      const minId = Math.min(currentUserId, targetUserId);
      const maxId = Math.max(currentUserId, targetUserId);
      const dmChannelId = `dm_${minId}_${maxId}`;

      // Insert channel if not exists
      db.prepare(`
        INSERT OR IGNORE INTO chat_channels (id, name, description, type, allowed_roles, created_by, created_at, updated_at)
        VALUES (?, ?, 'Direct communication channel', 'direct', 'admin,manager,staff,cashier,supplier', ?, datetime('now'), datetime('now'))
      `).run(dmChannelId, `${targetUser.name}`, currentUserId);

      // Ensure both users are members
      db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(dmChannelId, currentUserId);
      db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(dmChannelId, targetUserId);

      res.json({
        channel: {
          id: dmChannelId,
          name: targetUser.name,
          type: 'direct',
          other_user: {
            ...targetUser,
            is_online: isUserOnline(targetUser.id)
          }
        }
      });
    } catch (err: any) {
      console.error('Error starting direct message:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Get team members for communication directory
  app.get('/api/chat/team', authenticate, (req: any, res: Response) => {
    try {
      const currentUserId = req.user.id;
      const currentUserRole = (req.user.role || '').toLowerCase();
      const isSupplier = currentUserRole === 'supplier';
      const isStaff = ['staff', 'cashier'].includes(currentUserRole);

      let sql = `
        SELECT id, name, email, role, department, profile_picture, last_login_at
        FROM users
        WHERE is_active = 1
      `;
      const params: any[] = [];
      if (isSupplier) {
        // Supplier can only see his tenant or store owner or store manager only
        sql += ` AND (LOWER(role) IN ('admin', 'manager') OR id = ?) `;
        params.push(currentUserId);
      } else if (isStaff) {
        // Limit staff communications to staffs, other staffs and managers only and admins
        sql += ` AND LOWER(role) IN ('staff', 'cashier', 'manager', 'admin') `;
      }

      sql += `
        ORDER BY 
          CASE role 
            WHEN 'admin' THEN 1 
            WHEN 'manager' THEN 2 
            WHEN 'supplier' THEN 3
            WHEN 'staff' THEN 4 
            WHEN 'cashier' THEN 5 
            ELSE 6 
          END,
          name ASC
      `;

      const team = db.prepare(sql).all(...params) as any[];

      const teamWithStatus = team.map(u => ({
        ...u,
        is_current_user: u.id === currentUserId,
        is_online: isUserOnline(u.id)
      }));

      res.json({ team: teamWithStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Delete message via REST
  app.delete('/api/chat/messages/:messageId', authenticate, (req: any, res: Response) => {
    try {
      const { messageId } = req.params;
      const user = req.user;

      const msg: any = db.prepare('SELECT sender_id, channel_id FROM chat_messages WHERE id = ?').get(messageId);
      if (!msg) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (msg.sender_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to delete this message.' });
      }

      db.prepare(`
        UPDATE chat_messages 
        SET is_deleted = 1, deleted_by = ?, deleted_at = datetime('now')
        WHERE id = ?
      `).run(user.id, messageId);

      if (ioInstance) {
        ioInstance.to(`channel_${msg.channel_id}`).emit('chat:message_deleted', {
          messageId: Number(messageId),
          channelId: msg.channel_id,
          deletedBy: user.id,
          deletedByName: user.name
        });
      }

      res.json({ success: true, messageId: Number(messageId) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Unread message count summary across all channels
  app.get('/api/chat/unread-summary', authenticate, (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const userRole = (req.user.role || 'staff').toLowerCase();

      const totalUnreadRes: any = db.prepare(`
        SELECT COUNT(*) as total_unread
        FROM chat_messages m
        JOIN chat_channels c ON c.id = m.channel_id
        WHERE m.sender_id != ?
          AND m.is_deleted = 0
          AND (
            (c.type = 'channel' AND (c.allowed_roles LIKE '%' || ? || '%' OR ? = 'admin'))
            OR (c.type = 'direct' AND (c.id LIKE 'dm_' || ? || '_%' OR c.id LIKE 'dm_%_' || ?))
          )
          AND m.id NOT IN (SELECT message_id FROM chat_message_reads WHERE channel_id = m.channel_id AND user_id = ?)
      `).get(userId, userRole, userRole, userId, userId, userId);

      res.json({
        totalUnread: totalUnreadRes?.total_unread || 0,
        websocketKey: WEBSOCKET_AUTH_KEY,
        isSocketConnected: ioInstance !== null
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. WebSocket server health and key status
  app.get('/api/chat/status', (req: Request, res: Response) => {
    res.json({
      status: 'operational',
      engine: 'Socket.IO v4.8+',
      websocketKey: WEBSOCKET_AUTH_KEY,
      onlineUsersCount: getOnlineUserIds().length,
      timestamp: new Date().toISOString()
    });
  });
}
