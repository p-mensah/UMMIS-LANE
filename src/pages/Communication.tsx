import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat, ChatMessage, TeamMember } from '../context/ChatContext';
import { 
  Send, Hash, MessageSquare, Users, Shield, Search, Check, CheckCheck, 
  Trash2, CornerUpLeft, X, Smile, ShieldCheck, RefreshCw, Lock, ChevronRight,
  Megaphone, Plus, Camera, Image as ImageIcon, SwitchCamera, Download,
  Maximize2, Eye, UserCheck, AlertCircle, Building2,
  ArrowLeft, Truck, CreditCard, User, Sparkles, Clock
} from 'lucide-react';

interface PendingAttachment {
  id: number;
  name: string;
  dataUrl: string;
  size: string;
}

export default function Communication() {
  const { user } = useAuth();
  const { 
    channels, 
    directMessages, 
    activeChannelId, 
    activeChannel, 
    messages, 
    typingUsers, 
    onlineUsers, 
    isConnected, 
    isLoadingMessages, 
    teamMembers, 
    websocketKey, 
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
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmSearchQuery, setNewDmSearchQuery] = useState('');
  const [selectedMessageForReads, setSelectedMessageForReads] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<number | null>(null);
  const [isMsgSearchOpen, setIsMsgSearchOpen] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Attachments & Camera state
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom on new messages
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeChannelId]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  // Mark read when view is active
  useEffect(() => {
    if (activeChannelId) {
      markActiveAsRead();
    }
  }, [activeChannelId, messages.length]);

  // Handle camera video stream lifecycle
  useEffect(() => {
    if (showCameraModal) {
      startCamera(cameraFacingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showCameraModal, cameraFacingMode]);

  const startCamera = async (mode: 'environment' | 'user') => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device/browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play warning:', e));
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(err.message || 'Unable to start camera stream. You can upload a photo from your files.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Capture photo from video feed and compress down to a lightweight preview
  const capturePhoto = () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      // Scale down image to maintain a small thumbnail preview (max 800px on longest edge)
      const maxDim = 800;
      let targetW = width;
      let targetH = height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          targetW = maxDim;
          targetH = Math.round((height * maxDim) / width);
        } else {
          targetH = maxDim;
          targetW = Math.round((width * maxDim) / height);
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, targetW, targetH);
        // Export as JPEG with 0.72 quality for optimal size & speed
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        const sizeStr = `${Math.round(approxBytes / 1024)} KB`;

        const newAttachment: PendingAttachment = {
          id: Date.now(),
          name: `Camera_Capture_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.jpg`,
          dataUrl,
          size: sizeStr
        };

        setPendingAttachments(prev => [...prev, newAttachment]);
        setShowCameraModal(false);
      }
    } catch (err: any) {
      console.error('Error capturing photo:', err);
      setCameraError('Failed to capture frame from video.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Upload photo from device filesystem / gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const originalDataUrl = event.target?.result as string;
      if (!originalDataUrl) return;

      // Resize file image via canvas to keep preview small
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let targetW = img.width;
        let targetH = img.height;

        if (img.width > maxDim || img.height > maxDim) {
          if (img.width > img.height) {
            targetW = maxDim;
            targetH = Math.round((img.height * maxDim) / img.width);
          } else {
            targetH = maxDim;
            targetW = Math.round((img.width * maxDim) / img.height);
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
          const sizeStr = `${Math.round(approxBytes / 1024)} KB`;

          const newAttachment: PendingAttachment = {
            id: Date.now(),
            name: file.name,
            dataUrl: compressedDataUrl,
            size: sizeStr
          };

          setPendingAttachments(prev => [...prev, newAttachment]);
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingAttachment = (id: number) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (e.target.value.trim().length > 0) {
      sendTypingStart();
    } else {
      sendTypingStop();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && pendingAttachments.length === 0) || isSending) return;

    const content = inputText.trim();
    const replyId = replyingTo?.id;
    const attachmentsPayload = pendingAttachments.map(a => ({
      name: a.name,
      url: a.dataUrl,
      size: a.size,
      type: 'image/jpeg'
    }));

    setIsSending(true);
    setInputText('');
    setPendingAttachments([]);
    setReplyingTo(null);
    sendTypingStop();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await sendMessage(content, replyId, attachmentsPayload.length > 0 ? attachmentsPayload : undefined);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        textareaRef.current?.focus();
        scrollToBottom(true);
      }, 50);
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleDelete = async (msg: ChatMessage) => {
    if (window.confirm('Delete this message for everyone? This cannot be undone.')) {
      await deleteMessage(msg.id);
    }
  };

  const getRoleBadge = (_role?: string) => {
    // Role tags (Tenant / Owner, Manager, Staff, Supplier) removed from communication
    return null;
  };

  const isSupplierUser = user?.role === 'supplier';

  // Online count calculation
  const onlineMembersCount = teamMembers.filter(m => m.is_online).length;

  // Filter channels and DMs by searchFilter query
  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
    (c.description && c.description.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const filteredDms = directMessages.filter(d => {
    // If supplier, only allow DMs with tenant / owner or store manager
    if (isSupplierUser && d.other_user?.role) {
      const r = d.other_user.role.toLowerCase();
      if (r !== 'admin' && r !== 'manager') return false;
    }
    const matchesSearch = d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (d.other_user?.role && d.other_user.role.toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesSearch;
  });

  // In-conversation message search filter by content, sender name, or role
  const filteredMessages = messages.filter(msg => {
    if (!msgSearchQuery.trim()) return true;
    const q = msgSearchQuery.toLowerCase();
    const matchContent = (msg.content || '').toLowerCase().includes(q);
    const matchSender = (msg.sender_name || '').toLowerCase().includes(q);
    const matchRole = (msg.sender_role || '').toLowerCase().includes(q);
    return matchContent || matchSender || matchRole;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-slate-50 overflow-hidden -m-4 sm:-m-6">
      {/* Hidden file input for gallery/photo upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Top Banner / WebSocket Status Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <MessageSquare size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-slate-900 tracking-tight">Unified Communication Hub</h1>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Real-time messaging connecting store ownership, operations team, and managers</p>
          </div>
        </div>

        {/* WebSocket & Firm Members Presence Trigger */}
        <div className="flex items-center gap-2">
          {/* Quick New Direct Message Button */}
          <button
            onClick={() => {
              setNewDmSearchQuery('');
              setShowNewDmModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
            title="Start new direct message"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Message</span>
          </button>

          {/* WebSocket Status Indicator */}
          <div 
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              isConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={`WebSocket Key: ${websocketKey}`}
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="hidden md:inline font-mono text-[11px]">
              {isConnected ? 'Socket.IO Active' : 'Connecting...'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden xl:inline">
              [ws: {websocketKey.slice(0, 10)}...]
            </span>
          </div>

          <button
            onClick={() => {
              refreshChannels();
              refreshTeamMembers();
            }}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Refresh channels and conversations"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Channels & Conversations */}
        <div className={`w-full md:w-80 lg:w-88 bg-white border-r border-slate-200 flex flex-col shrink-0 ${activeChannelId ? 'hidden md:flex' : 'flex'}`}>
          {/* Header & Search Bar (Filter removed, search maintained) */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-blue-600" />
                <span>Conversations</span>
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {filteredChannels.length + filteredDms.length} Active
              </span>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search channels & direct messages..."
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
              {searchFilter && (
                <button 
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable List of Channels & Direct Messages */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {/* Organizational Channels Section */}
            <div className="p-2">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Firm Channels</span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                      {filteredChannels.length}
                    </span>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    {filteredChannels.map(channel => {
                      const isActive = activeChannelId === channel.id;
                      const isSuppliers = channel.id === 'channel_suppliers';
                      const isAnnouncements = channel.id === 'channel_announcements';
                      const isManagement = channel.id === 'channel_management';
                      const isShifts = channel.id === 'channel_shifts';

                      return (
                        <button
                          key={channel.id}
                          onClick={() => setActiveChannelId(channel.id)}
                          className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-2.5 cursor-pointer ${
                            isActive
                              ? 'bg-blue-50 border border-blue-200 shadow-2xs'
                              : 'hover:bg-slate-100/80 border border-transparent'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : isSuppliers
                              ? 'bg-emerald-100 text-emerald-700'
                              : isManagement
                              ? 'bg-amber-100 text-amber-700'
                              : isAnnouncements
                              ? 'bg-purple-100 text-purple-700'
                              : isShifts
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isSuppliers ? (
                              <Truck size={15} />
                            ) : isAnnouncements ? (
                              <Megaphone size={15} />
                            ) : isManagement ? (
                              <Shield size={15} />
                            ) : isShifts ? (
                              <Clock size={15} />
                            ) : (
                              <Hash size={15} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold truncate ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>
                                {channel.name}
                              </span>
                              {channel.unread_count > 0 && (
                                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full shrink-0">
                                  {channel.unread_count}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {channel.last_message ? (
                                <span>
                                  <strong className="text-slate-700">{channel.last_message.sender_name.split(' ')[0]}:</strong>{' '}
                                  {channel.last_message.content}
                                </span>
                              ) : (
                                channel.description
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Messages Section */}
                <div className="p-2 border-t border-slate-100">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Direct Conversations</span>
                    <button
                      onClick={() => setShowNewDmModal(true)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition flex items-center gap-1 text-[10px] font-bold"
                    >
                      <Plus size={12} />
                      <span>New Chat</span>
                    </button>
                  </div>

                  {filteredDms.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs text-slate-400">
                        {searchFilter ? 'No direct conversations match your search.' : 'No active direct messages yet.'}
                      </p>
                      <button
                        onClick={() => setShowNewDmModal(true)}
                        className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus size={13} />
                        <span>Start chat with a team member</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-0.5">
                      {filteredDms.map(dm => {
                        const isActive = activeChannelId === dm.id;
                        const other = dm.other_user;

                        return (
                          <button
                            key={dm.id}
                            onClick={() => setActiveChannelId(dm.id)}
                            className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-2.5 ${
                              isActive
                                ? 'bg-blue-50 border border-blue-200 shadow-2xs'
                                : 'hover:bg-slate-100/80 border border-transparent'
                            }`}
                          >
                            <div className="relative shrink-0">
                              {other?.profile_picture ? (
                                <img src={other.profile_picture} alt={other.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center uppercase">
                                  {dm.name.charAt(0)}
                                </div>
                              )}
                              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                other?.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                              }`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-bold truncate ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>
                                  {dm.name}
                                </span>
                                {dm.unread_count > 0 && (
                                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full shrink-0">
                                    {dm.unread_count}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 mt-0.5">
                                {other?.role && getRoleBadge(other.role)}
                                <span className="text-[11px] text-slate-500 truncate">
                                  {dm.last_message ? dm.last_message.content : 'Direct conversation'}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
          </div>
        </div>

        {/* Center Main Chat Section */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {activeChannel ? (
            <>
              {/* Channel Header Bar */}
              <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between shadow-2xs shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mobile Back Button to Channels List */}
                  <button
                    onClick={() => setActiveChannelId('')}
                    className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition shrink-0 cursor-pointer"
                    title="Back to conversation list"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeChannel.type === 'direct'
                      ? 'bg-slate-100 text-slate-700'
                      : activeChannel.id === 'channel_suppliers'
                      ? 'bg-emerald-100 text-emerald-700'
                      : activeChannel.id === 'channel_announcements'
                      ? 'bg-purple-100 text-purple-700'
                      : activeChannel.id === 'channel_management'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {activeChannel.type === 'direct' ? (
                      <Users size={18} />
                    ) : activeChannel.id === 'channel_suppliers' ? (
                      <Truck size={18} />
                    ) : activeChannel.id === 'channel_announcements' ? (
                      <Megaphone size={18} />
                    ) : activeChannel.id === 'channel_management' ? (
                      <Shield size={18} />
                    ) : (
                      <Hash size={18} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 truncate">
                        {activeChannel.name}
                      </h2>
                      {activeChannel.other_user?.role && getRoleBadge(activeChannel.other_user.role)}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate mt-0.5">
                      {activeChannel.type === 'direct' ? (
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className={`w-2 h-2 rounded-full ${activeChannel.other_user?.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          <span className={activeChannel.other_user?.is_online ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium'}>
                            {activeChannel.other_user?.is_online ? 'Online now' : 'Offline • Direct messages will deliver immediately (WhatsApp style)'}
                          </span>
                          {activeChannel.other_user?.department && ` • ${activeChannel.other_user.department}`}
                        </span>
                      ) : (
                        <span>{activeChannel.description || 'Channel conversation'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Read Receipts Indicator */}
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600 text-xs font-semibold border border-slate-200">
                    <CheckCheck size={14} className="text-blue-600" />
                    <span>Read Receipts Active</span>
                  </span>

                  {/* In-Conversation Message Search Toggle */}
                  <button
                    onClick={() => {
                      setIsMsgSearchOpen(prev => !prev);
                      if (isMsgSearchOpen) setMsgSearchQuery('');
                    }}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      isMsgSearchOpen || msgSearchQuery.trim()
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                    }`}
                    title="Search conversation messages by content or sender"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </div>

              {/* In-Conversation Message Filter Search Bar */}
              {(isMsgSearchOpen || msgSearchQuery) && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150 shrink-0">
                  <div className="flex-1 flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={msgSearchQuery}
                      onChange={(e) => setMsgSearchQuery(e.target.value)}
                      placeholder="Filter messages by content, keyword, sender name, or role..."
                      className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                      autoFocus
                    />
                    {msgSearchQuery && (
                      <button
                        onClick={() => setMsgSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                        title="Clear search input"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {msgSearchQuery && (
                    <span className="text-[11px] font-bold text-slate-500 shrink-0">
                      {filteredMessages.length} of {messages.length} found
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setIsMsgSearchOpen(false);
                      setMsgSearchQuery('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 hover:bg-slate-200 rounded transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
                {isLoadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <RefreshCw size={24} className="animate-spin text-blue-600" />
                    <p className="text-xs font-medium">Loading conversation messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 text-center p-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">No messages yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Be the first to send a message or attach a live camera snapshot in this channel. Staff, Managers, and Admins will see updates instantly.
                    </p>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 text-center p-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                      <Search size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">No matching messages</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      No messages in this conversation match "{msgSearchQuery}". Try a different search keyword or sender name.
                    </p>
                    <button
                      onClick={() => setMsgSearchQuery('')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Clear Search Filter
                    </button>
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    const canDelete = isMe || user?.role === 'admin';
                    const hasReplies = Boolean(msg.reply_preview);
                    const hasAttachments = Boolean(msg.attachments && msg.attachments.length > 0);

                    return (
                      <div
                        key={msg.id}
                        className={`group flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {/* Avatar */}
                        {msg.sender_avatar ? (
                          <img 
                            src={msg.sender_avatar} 
                            alt={msg.sender_name} 
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 mt-1" 
                          />
                        ) : (
                          <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 uppercase mt-1 ${
                            isMe ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {msg.sender_name.charAt(0)}
                          </div>
                        )}

                        {/* Bubble Content */}
                        <div className={`max-w-[75%] sm:max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                          {/* Sender Name & Role */}
                          <div className={`flex items-center gap-1.5 text-[11px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span className="font-bold text-slate-700">{isMe ? 'You' : msg.sender_name}</span>
                            {getRoleBadge(msg.sender_role)}
                            <span className="text-slate-400 text-[10px]">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Message Box */}
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed shadow-2xs relative group/bubble ${
                              msg.is_deleted
                                ? 'bg-slate-100 text-slate-400 italic border border-slate-200'
                                : isMe
                                ? 'bg-blue-600 text-white rounded-tr-xs'
                                : 'bg-white text-slate-900 border border-slate-200 rounded-tl-xs'
                            }`}
                          >
                            {/* Quoted Reply Preview */}
                            {hasReplies && msg.reply_preview && (
                              <div className={`mb-2 p-2 rounded-lg text-[11px] border-l-3 ${
                                isMe 
                                  ? 'bg-blue-700/60 border-blue-300 text-blue-100' 
                                  : 'bg-slate-100 border-blue-500 text-slate-600'
                              }`}>
                                <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 opacity-90">
                                  {msg.reply_preview.sender_name}
                                </div>
                                <div className="truncate opacity-90">{msg.reply_preview.content}</div>
                              </div>
                            )}

                            {/* Image Attachments Preview Grid */}
                            {!msg.is_deleted && hasAttachments && msg.attachments && (
                              <div className="mb-2 space-y-1.5">
                                {msg.attachments.map((att: any, attIdx: number) => (
                                  <div 
                                    key={attIdx}
                                    onClick={() => setActiveLightboxImage(att.url)}
                                    className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-slate-200/50 bg-black/10 max-w-sm"
                                  >
                                    <img 
                                      src={att.url} 
                                      alt={att.name || 'Attached preview'} 
                                      className="max-h-56 w-auto object-cover rounded-xl transition duration-200 group-hover/img:scale-102"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-[11px] font-bold">
                                      <Maximize2 size={14} />
                                      <span>Click to enlarge</span>
                                    </div>
                                    {att.size && (
                                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
                                        {att.size}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.is_deleted ? (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Trash2 size={13} />
                                <span>This message was deleted</span>
                              </div>
                            ) : (
                              msg.content && <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                            )}

                            {/* Hover Actions: Reply & Delete */}
                            {!msg.is_deleted && (
                              <div className={`absolute top-1 ${isMe ? '-left-16' : '-right-16'} hidden group-hover/bubble:flex items-center gap-1 bg-white border border-slate-200 shadow-md rounded-lg p-1 z-10`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(msg);
                                    textareaRef.current?.focus();
                                  }}
                                  className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition cursor-pointer"
                                  title="Reply to message"
                                >
                                  <CornerUpLeft size={13} />
                                </button>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(msg)}
                                    className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                    title="Delete message"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Message Reactions Pills */}
                          {!msg.is_deleted && msg.reactions && msg.reactions.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              {msg.reactions.map(rx => {
                                const reactedByMe = rx.users.some(u => u.user_id === user?.id);
                                const names = rx.users.map(u => u.user_name).join(', ');
                                return (
                                  <button
                                    key={rx.emoji}
                                    type="button"
                                    onClick={() => toggleReaction(msg.id, rx.emoji)}
                                    title={`${names} reacted with ${rx.emoji}. Click to toggle.`}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition cursor-pointer border ${
                                      reactedByMe
                                        ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <span className="text-sm leading-none">{rx.emoji}</span>
                                    <span className="text-[11px] font-semibold">{rx.count}</span>
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id);
                                }}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 text-xs transition cursor-pointer"
                                title="Add reaction"
                              >
                                <Smile size={11} />
                              </button>
                            </div>
                          )}

                          {/* Footer with Read Status / Receipt */}
                          {!msg.is_deleted && (
                            <div className={`flex items-center gap-1 text-[10px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                              {isMe && (
                                <>
                                  {msg.is_read ? (
                                    <span 
                                      onClick={() => setSelectedMessageForReads(msg)}
                                      className="flex items-center gap-1 text-blue-600 font-bold cursor-pointer hover:underline"
                                      title="Read by recipient(s). Click to view details."
                                    >
                                      <CheckCheck size={14} className="text-blue-600" />
                                      {activeChannel.type === 'channel' ? (
                                        <span>Read by {msg.read_by.filter(r => r.user_id !== user?.id).length}</span>
                                      ) : (
                                        <span>Read</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-slate-400" title="Delivered to server">
                                      <Check size={14} />
                                      <span>Sent</span>
                                    </span>
                                  )}
                                </>
                              )}

                              {!isMe && activeChannel.type === 'channel' && msg.read_by.length > 0 && (
                                <button
                                  onClick={() => setSelectedMessageForReads(msg)}
                                  className="text-[10px] text-slate-400 hover:text-blue-600 transition"
                                >
                                  {msg.read_by.length} reads
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing Indicator Bar */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-1.5 bg-white border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 animate-in fade-in">
                  <span className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                  </span>
                  <span>
                    <strong>{typingUsers.map(u => u.userName).join(', ')}</strong> {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}

              {/* Reply Quote Banner */}
              {replyingTo && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerUpLeft size={14} className="text-blue-600 shrink-0" />
                    <div className="truncate">
                      Replying to <strong>{replyingTo.sender_name}</strong>: "{replyingTo.content}"
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:bg-blue-100 rounded text-blue-700 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Attached Image Preview Tray before Sending */}
              {pendingAttachments.length > 0 && (
                <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center gap-3 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Attached:</span>
                  {pendingAttachments.map(att => (
                    <div 
                      key={att.id}
                      className="relative group/att shrink-0 bg-white border border-slate-300 rounded-xl p-1 shadow-2xs flex items-center gap-2 pr-2"
                    >
                      <img 
                        src={att.dataUrl} 
                        alt="Preview" 
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200" 
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">{att.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{att.size}</span>
                      </div>
                      <button
                        onClick={() => removePendingAttachment(att.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remove attached image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* WhatsApp-style Offline Delivery Info Banner */}
              {activeChannel.type === 'direct' && !activeChannel.other_user?.is_online && (
                <div className="px-3.5 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                    <span className="truncate">
                      <strong>{activeChannel.name}</strong> is currently offline. Your message will deliver immediately to their inbox.
                    </span>
                  </span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-bold shrink-0 border border-blue-200">
                    Offline Delivery Active
                  </span>
                </div>
              )}

              {/* Bottom Message Input Bar with Live Camera & Gallery Triggers */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0 relative">
                {showEmojiPicker && (
                  <div className="absolute bottom-16 left-3 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-30 flex items-center gap-2">
                    {['👍', '🙏', '✅', '❤️', '🔥', '👏', '👀', '🎉', '🚀', '💯'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleAddEmoji(emoji)}
                        className="text-lg p-1.5 hover:bg-slate-100 rounded-lg transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* Camera Snap Photo Button */}
                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition shrink-0 shadow-2xs"
                    title="Take photo with device camera"
                  >
                    <Camera size={18} />
                  </button>

                  {/* Pick Photo File Fallback */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition shrink-0 shadow-2xs"
                    title="Upload or pick photo from device"
                  >
                    <ImageIcon size={18} />
                  </button>

                  {/* Emoji Picker Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition shrink-0"
                    title="Insert emoji"
                  >
                    <Smile size={18} />
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${activeChannel.name}... (Press Enter to send)`}
                      rows={1}
                      className="w-full p-2.5 max-h-32 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition"
                    />
                  </div>

                  <button
                    onClick={handleSend}
                    disabled={(!inputText.trim() && pendingAttachments.length === 0) || isSending}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition shrink-0 shadow-xs flex items-center justify-center"
                    title="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <MessageSquare size={28} />
              </div>
              <h2 className="text-base font-bold text-slate-800">Select a Channel or Team Member</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose an organizational channel or click on any staff, manager, or admin from the firm roster to begin real-time communication.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Modal: Interactive Live Device Camera Capture */}
      {showCameraModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowCameraModal(false)}
        >
          <div 
            className="bg-slate-900 text-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-800 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white">Capture Photo for Message</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCameraFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Switch camera (Front / Back)"
                >
                  <SwitchCamera size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCameraModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative bg-black aspect-4/3 flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center space-y-3">
                  <AlertCircle size={32} className="text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCameraModal(false);
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    <ImageIcon size={15} />
                    <span>Upload from Device Files</span>
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Viewfinder crosshair overlay */}
                  <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-white/60 absolute top-2 left-2" />
                    <div className="w-6 h-6 border-t-2 border-r-2 border-white/60 absolute top-2 right-2" />
                    <div className="w-6 h-6 border-b-2 border-l-2 border-white/60 absolute bottom-2 left-2" />
                    <div className="w-6 h-6 border-b-2 border-r-2 border-white/60 absolute bottom-2 right-2" />
                  </div>
                </>
              )}
            </div>

            {/* Camera Actions Footer */}
            <div className="p-4 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowCameraModal(false);
                  fileInputRef.current?.click();
                }}
                className="text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-1"
              >
                <ImageIcon size={14} />
                <span>Pick from Gallery</span>
              </button>

              {!cameraError && (
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isCapturing}
                  className="w-14 h-14 rounded-full border-4 border-white bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition active:scale-95 shadow-lg"
                  title="Snap photo"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                className="text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lightbox Full-Size Image Preview */}
      {activeLightboxImage && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setActiveLightboxImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <a
                href={activeLightboxImage}
                download="chat_attachment.jpg"
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow-lg"
                title="Download full image"
              >
                <Download size={18} />
              </a>
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow-lg"
                title="Close preview"
              >
                <X size={18} />
              </button>
            </div>

            <img 
              src={activeLightboxImage} 
              alt="Enlarged preview" 
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Modal: Read Receipts Info */}
      {selectedMessageForReads && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedMessageForReads(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCheck size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Message Read Receipts</h3>
              </div>
              <button 
                onClick={() => setSelectedMessageForReads(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900">Message content:</span>
              <p className="mt-1 text-slate-600 italic">"{selectedMessageForReads.content || 'Photo attachment'}"</p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Read by ({selectedMessageForReads.read_by.length} members):
              </div>
              {selectedMessageForReads.read_by.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No other recipients have read this message yet.</p>
              ) : (
                selectedMessageForReads.read_by.map(receipt => (
                  <div 
                    key={receipt.user_id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                        {receipt.user_name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-800">{receipt.user_name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(receipt.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMessageForReads(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Direct Message Picker */}
      {showNewDmModal && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowNewDmModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-3.5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Start Direct Message</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Connect with Store Owner, Managers, Staff, or Suppliers</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewDmModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input inside Modal */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={newDmSearchQuery}
                onChange={(e) => setNewDmSearchQuery(e.target.value)}
                placeholder="Search by name, company, role, or email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                autoFocus
              />
              {newDmSearchQuery && (
                <button
                  onClick={() => setNewDmSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtered Members List */}
            <div className="space-y-1 max-h-72 overflow-y-auto divide-y divide-slate-100 custom-scrollbar pr-1">
              {teamMembers
                .filter(m => m.id !== user?.id)
                .filter(m => {
                  const myRole = (user?.role || '').toLowerCase();
                  if (myRole === 'staff' || myRole === 'cashier') {
                    const r = (m.role || '').toLowerCase();
                    if (!['staff', 'cashier', 'manager', 'admin'].includes(r)) return false;
                  }
                  if (isSupplierUser) {
                    const r = m.role.toLowerCase();
                    if (r !== 'admin' && r !== 'manager') return false;
                  }
                  if (!newDmSearchQuery.trim()) return true;
                  const q = newDmSearchQuery.toLowerCase();
                  return (
                    (m.name || '').toLowerCase().includes(q) ||
                    (m.email || '').toLowerCase().includes(q) ||
                    (m.role || '').toLowerCase().includes(q) ||
                    (m.department || '').toLowerCase().includes(q)
                  );
                })
                .map(member => (
                  <button
                    key={member.id}
                    onClick={async () => {
                      await startDirectMessage(member.id);
                      setShowNewDmModal(false);
                    }}
                    className="w-full p-2.5 hover:bg-blue-50/70 rounded-xl flex items-center justify-between transition text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        {member.profile_picture ? (
                          <img src={member.profile_picture} alt={member.name} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center uppercase">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          member.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                        }`} />
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {member.is_online ? (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">Online</span>
                          ) : (
                            <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">Offline • Available</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {getRoleBadge(member.role)}
                          <span className="text-[10px] text-slate-400 truncate">{member.department || member.email}</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition flex items-center gap-1 shrink-0">
                      Chat <ChevronRight size={14} />
                    </span>
                  </button>
                ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowNewDmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
