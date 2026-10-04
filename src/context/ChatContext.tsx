import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { getSocket, reconnectSocket, disconnectSocket, WEBSOCKET_KEY } from '../lib/socket';
import { fetchApi } from '../lib/api';

export interface ChatMessage {
  id: number;
  channel_id: string;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  sender_avatar?: string | null;
  content: string;
  attachments?: any[] | null;
  reply_to_id?: number | null;
  reply_preview?: { sender_name: string; content: string } | null;
  is_deleted: boolean;
  deleted_by?: number | null;
  deleted_at?: string | null;
  created_at: string;
  read_by: { user_id: number; user_name: string; read_at: string }[];
  reactions?: { emoji: string; count: number; users: { user_id: number; user_name: string }[] }[];
  is_read: boolean;
  is_read_by_me: boolean;
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'channel' | 'direct';
  allowed_roles?: string;
  unread_count: number;
  last_message?: {
    id: number;
    content: string;
    sender_name: string;
    created_at: string;
    is_deleted: number;
  } | null;
  other_user?: {
    id: number;
    name: string;
    role: string;
    email: string;
    profile_picture?: string;
    department?: string;
    is_online?: boolean;
  } | null;
}

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  profile_picture?: string;
  is_online?: boolean;
  is_current_user?: boolean;
}

interface ChatContextType {
  channels: ChatChannel[];
  directMessages: ChatChannel[];
  activeChannelId: string | null;
  activeChannel: ChatChannel | null;
  messages: ChatMessage[];
  typingUsers: { userId: number; userName: string; userRole: string }[];
  onlineUsers: { id: number; name: string; role: string; profile_picture?: string; department?: string }[];
  totalUnread: number;
  isConnected: boolean;
  isLoadingMessages: boolean;
  teamMembers: TeamMember[];
  websocketKey: string;
  setActiveChannelId: (id: string | null) => void;
  sendMessage: (content: string, replyToId?: number, attachments?: any[]) => Promise<boolean>;
  deleteMessage: (messageId: number) => Promise<boolean>;
  markActiveAsRead: () => void;
  startDirectMessage: (targetUserId: number) => Promise<string | null>;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  toggleReaction: (messageId: number, emoji: string) => Promise<void>;
  refreshChannels: () => Promise<void>;
  refreshTeamMembers: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useNotifications();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [directMessages, setDirectMessages] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>('channel_general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ userId: number; userName: string; userRole: string }[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  activeChannelIdRef.current = activeChannelId;

  const typingTimeoutRef = useRef<{ [userId: number]: any }>({});
  const isTypingLocalRef = useRef(false);
  const stopTypingTimerRef = useRef<any>(null);

  // Active channel details
  const activeChannel = 
    channels.find(c => c.id === activeChannelId) ||
    directMessages.find(d => d.id === activeChannelId) ||
    null;

  // Refresh channels & unread summary from REST API
  const refreshChannels = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchApi<{ channels: ChatChannel[]; directMessages: ChatChannel[]; websocketKey: string }>('/api/chat/channels');
      if (data) {
        setChannels(data.channels || []);
        setDirectMessages(data.directMessages || []);
        
        const chanUnread = (data.channels || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
        const dmUnread = (data.directMessages || []).reduce((acc, d) => acc + (d.unread_count || 0), 0);
        setTotalUnread(chanUnread + dmUnread);
      }
    } catch (err) {
      console.warn('Error refreshing channels:', err);
    }
  }, [user]);

  // Refresh team members for directory
  const refreshTeamMembers = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchApi<{ team: TeamMember[] }>('/api/chat/team');
      if (data?.team) {
        setTeamMembers(data.team);
      }
    } catch (err) {
      console.warn('Error fetching team members:', err);
    }
  }, [user]);

  // Fetch messages for active channel
  const loadMessages = useCallback(async (channelId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await fetchApi<{ messages: ChatMessage[] }>(`/api/chat/channels/${channelId}/messages?limit=150`);
      if (data?.messages) {
        setMessages(data.messages);
      }

      // Mark channel as read
      await fetchApi(`/api/chat/channels/${channelId}/read`, { method: 'POST' });

      // Update local unread counts
      setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unread_count: 0 } : c));
      setDirectMessages(prev => prev.map(d => d.id === channelId ? { ...d, unread_count: 0 } : d));
    } catch (err) {
      console.warn(`Error loading messages for ${channelId}:`, err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Whenever active channel changes, load its messages and join socket room
  useEffect(() => {
    if (!activeChannelId || !user) return;

    loadMessages(activeChannelId);
    setTypingUsers([]);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:join_channel', { channelId: activeChannelId });
      socket.emit('chat:mark_read', { channelId: activeChannelId });
    }

    return () => {
      if (socket.connected) {
        socket.emit('chat:leave_channel', { channelId: activeChannelId });
      }
    };
  }, [activeChannelId, user, loadMessages]);

  // Initialize Socket.IO connection and event listeners
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setIsConnected(false);
      return;
    }

    const token = localStorage.getItem('token');
    const socket = reconnectSocket(token || undefined);

    const handleConnect = () => {
      setIsConnected(true);
      refreshChannels();
      refreshTeamMembers();

      if (activeChannelIdRef.current) {
        socket.emit('chat:join_channel', { channelId: activeChannelIdRef.current });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handlePresenceUpdate = (data: { onlineUsers: any[]; onlineUserIds: number[] }) => {
      if (data?.onlineUsers) {
        setOnlineUsers(data.onlineUsers);
        // Also update teamMembers is_online state
        setTeamMembers(prev => prev.map(m => ({
          ...m,
          is_online: data.onlineUserIds.includes(m.id)
        })));
        // Also update directMessages online state
        setDirectMessages(prev => prev.map(dm => {
          if (dm.other_user) {
            return {
              ...dm,
              other_user: {
                ...dm.other_user,
                is_online: data.onlineUserIds.includes(dm.other_user.id)
              }
            };
          }
          return dm;
        }));
      }
    };

    // Incoming message in any channel
    const handleNewMessage = (msg: ChatMessage) => {
      const currentActiveId = activeChannelIdRef.current;

      if (msg.channel_id === currentActiveId) {
        // Append to current messages if not already present
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Mark as read immediately if not sent by me
        if (msg.sender_id !== user.id) {
          socket.emit('chat:mark_read', { channelId: msg.channel_id, messageIds: [msg.id] });
        }
      } else {
        // Increment unread count for that channel
        setChannels(prev => prev.map(c => {
          if (c.id === msg.channel_id) {
            return {
              ...c,
              unread_count: (c.unread_count || 0) + 1,
              last_message: {
                id: msg.id,
                content: msg.content,
                sender_name: msg.sender_name,
                created_at: msg.created_at,
                is_deleted: 0
              }
            };
          }
          return c;
        }));

        setDirectMessages(prev => prev.map(d => {
          if (d.id === msg.channel_id) {
            return {
              ...d,
              unread_count: (d.unread_count || 0) + 1,
              last_message: {
                id: msg.id,
                content: msg.content,
                sender_name: msg.sender_name,
                created_at: msg.created_at,
                is_deleted: 0
              }
            };
          }
          return d;
        }));

        setTotalUnread(prev => prev + 1);

        // Notify with in-app toast if sent by someone else
        if (msg.sender_id !== user.id) {
          addToast(
            `💬 ${msg.sender_name} (${msg.sender_role}): ${msg.content.slice(0, 60)}${msg.content.length > 60 ? '...' : ''}`,
            'info'
          );
        }
      }
    };

    // Real-time read receipt updates: double ticks turn blue!
    const handleMessagesRead = (data: { channelId: string; userId: number; userName: string; messageIds: number[]; readAt: string }) => {
      if (data.channelId === activeChannelIdRef.current) {
        setMessages(prev => prev.map(m => {
          if (data.messageIds.length === 0 || data.messageIds.includes(m.id)) {
            const alreadyRead = m.read_by.some(r => r.user_id === data.userId);
            const updatedReadBy = alreadyRead ? m.read_by : [...m.read_by, { user_id: data.userId, user_name: data.userName, read_at: data.readAt }];
            const isRead = updatedReadBy.some(r => r.user_id !== m.sender_id);
            return {
              ...m,
              read_by: updatedReadBy,
              is_read: isRead,
              is_read_by_me: data.userId === user.id ? true : m.is_read_by_me
            };
          }
          return m;
        }));
      }
    };

    // Real-time message deletion
    const handleMessageDeleted = (data: { messageId: number; channelId: string; deletedBy: number; deletedByName: string }) => {
      if (data.channelId === activeChannelIdRef.current) {
        setMessages(prev => prev.map(m => {
          if (m.id === data.messageId) {
            return {
              ...m,
              is_deleted: true,
              content: 'This message was deleted',
              attachments: null
            };
          }
          return m;
        }));
      }

      // Update last message in channel list if it was the deleted message
      setChannels(prev => prev.map(c => {
        if (c.id === data.channelId && c.last_message?.id === data.messageId) {
          return {
            ...c,
            last_message: { ...c.last_message, content: 'This message was deleted', is_deleted: 1 }
          };
        }
        return c;
      }));
    };

    // Typing status
    const handleUserTyping = (data: { channelId: string; userId: number; userName: string; userRole: string }) => {
      if (data.channelId === activeChannelIdRef.current && data.userId !== user.id) {
        setTypingUsers(prev => {
          if (prev.some(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, userName: data.userName, userRole: data.userRole }];
        });

        // Auto remove typing status after 4 seconds of inactivity
        if (typingTimeoutRef.current[data.userId]) {
          clearTimeout(typingTimeoutRef.current[data.userId]);
        }
        typingTimeoutRef.current[data.userId] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }, 4000);
      }
    };

    const handleUserStoppedTyping = (data: { channelId: string; userId: number }) => {
      if (data.channelId === activeChannelIdRef.current) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        if (typingTimeoutRef.current[data.userId]) {
          clearTimeout(typingTimeoutRef.current[data.userId]);
        }
      }
    };

    // Reaction updated
    const handleReactionUpdated = (data: { messageId: number; channelId: string; reactions: any[] }) => {
      if (data.channelId === activeChannelIdRef.current) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
      }
    };

    // Background DM alert
    const handleDmAlert = (data: { channelId: string; message: any; sender: any }) => {
      refreshChannels();
    };

    // Handle token refreshed event from server
    const handleTokenRefreshed = (data: { token: string; user?: any }) => {
      if (data?.token) {
        localStorage.setItem('token', data.token);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:messages_read', handleMessagesRead);
    socket.on('chat:message_deleted', handleMessageDeleted);
    socket.on('chat:user_typing', handleUserTyping);
    socket.on('chat:user_stopped_typing', handleUserStoppedTyping);
    socket.on('chat:reaction_updated', handleReactionUpdated);
    socket.on('chat:dm_alert', handleDmAlert);
    socket.on('auth:refreshed_token', handleTokenRefreshed);

    // Initial fetch
    refreshChannels();
    refreshTeamMembers();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:messages_read', handleMessagesRead);
      socket.off('chat:message_deleted', handleMessageDeleted);
      socket.off('chat:user_typing', handleUserTyping);
      socket.off('chat:user_stopped_typing', handleUserStoppedTyping);
      socket.off('chat:reaction_updated', handleReactionUpdated);
      socket.off('chat:dm_alert', handleDmAlert);
      socket.off('auth:refreshed_token', handleTokenRefreshed);
    };
  }, [user, addToast, refreshChannels, refreshTeamMembers]);

  // Send message
  const sendMessage = async (content: string, replyToId?: number, attachments?: any[]): Promise<boolean> => {
    if (!activeChannelId || !content.trim()) return false;

    const socket = getSocket();
    sendTypingStop();

    return new Promise((resolve) => {
      if (socket.connected) {
        socket.emit('chat:send_message', {
          channelId: activeChannelId,
          content: content.trim(),
          replyToId,
          attachments
        }, (response: any) => {
          if (response?.success) {
            resolve(true);
          } else {
            console.error('Socket message send error:', response?.error);
            resolve(false);
          }
        });
      } else {
        // Fallback REST POST if socket is briefly reconnecting
        fetchApi<{ message: ChatMessage }>(`/api/chat/channels/${activeChannelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: content.trim(), replyToId, attachments })
        }).then(res => {
          if (res?.message) {
            setMessages(prev => [...prev, res.message]);
            resolve(true);
          } else {
            resolve(false);
          }
        }).catch(err => {
          console.error('REST message send fallback error:', err);
          resolve(false);
        });
      }
    });
  };

  // Delete message
  const deleteMessage = async (messageId: number): Promise<boolean> => {
    if (!activeChannelId) return false;

    const socket = getSocket();
    return new Promise((resolve) => {
      if (socket.connected) {
        socket.emit('chat:delete_message', {
          messageId,
          channelId: activeChannelId
        }, (response: any) => {
          if (response?.success) {
            resolve(true);
          } else {
            addToast(response?.error || 'Failed to delete message', 'error');
            resolve(false);
          }
        });
      } else {
        fetchApi(`/api/chat/messages/${messageId}`, { method: 'DELETE' })
          .then(() => resolve(true))
          .catch(err => {
            addToast(err.message || 'Failed to delete message', 'error');
            resolve(false);
          });
      }
    });
  };

  // Mark active channel as read
  const markActiveAsRead = () => {
    if (!activeChannelId) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:mark_read', { channelId: activeChannelId });
    }
    setChannels(prev => prev.map(c => c.id === activeChannelId ? { ...c, unread_count: 0 } : c));
    setDirectMessages(prev => prev.map(d => d.id === activeChannelId ? { ...d, unread_count: 0 } : d));
  };

  // Start or open Direct Message
  const startDirectMessage = async (targetUserId: number): Promise<string | null> => {
    try {
      const data = await fetchApi<{ channel: any }>('/api/chat/direct', {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
      });
      if (data?.channel?.id) {
        await refreshChannels();
        setActiveChannelId(data.channel.id);
        return data.channel.id;
      }
      return null;
    } catch (err: any) {
      addToast(err.message || 'Unable to open direct chat', 'error');
      return null;
    }
  };

  // Typing triggers
  const sendTypingStart = () => {
    if (!activeChannelId) return;
    const socket = getSocket();
    if (!socket.connected) return;

    if (!isTypingLocalRef.current) {
      isTypingLocalRef.current = true;
      socket.emit('chat:typing_start', { channelId: activeChannelId });
    }

    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
    }

    stopTypingTimerRef.current = setTimeout(() => {
      sendTypingStop();
    }, 2500);
  };

  const sendTypingStop = () => {
    if (!activeChannelId || !isTypingLocalRef.current) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:typing_stop', { channelId: activeChannelId });
    }
    isTypingLocalRef.current = false;
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
    }
  };

  // Toggle emoji reaction
  const toggleReaction = async (messageId: number, emoji: string) => {
    if (!activeChannelId) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:toggle_reaction', { channelId: activeChannelId, messageId, emoji });
    } else {
      fetchApi(`/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji, channelId: activeChannelId })
      }).catch(console.error);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        channels,
        directMessages,
        activeChannelId,
        activeChannel,
        messages,
        typingUsers,
        onlineUsers,
        totalUnread,
        isConnected,
        isLoadingMessages,
        teamMembers,
        websocketKey: WEBSOCKET_KEY,
        setActiveChannelId,
        sendMessage,
        deleteMessage,
        markActiveAsRead,
        startDirectMessage,
        sendTypingStart,
        sendTypingStop,
        toggleReaction,
        refreshChannels,
        refreshTeamMembers
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
