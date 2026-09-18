import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { 
  User, Camera, Lock, Mail, Phone, ShieldCheck, Check, 
  AlertCircle, X, Loader2, KeyRound, Sparkles, Trash2, Building2
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
];

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useModalDismiss(isOpen, onClose);

  // Initialize or fetch latest profile
  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setProfilePicture(user.profile_picture || null);
      setFeedback(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);

      // Fetch fresh profile data from backend
      setFetching(true);
      fetchApi('/profile')
        .then((data: any) => {
          if (data) {
            setName(data.name || user.name || '');
            setEmail(data.email || user.email || '');
            setPhone(data.phone || '');
            setProfilePicture(data.profile_picture || null);
          }
        })
        .catch(err => {
          console.warn('Could not fetch server profile, using session defaults:', err);
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Handle local image file selection
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please select an image file (PNG, JPG, WEBP).' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Image size should be under 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfilePicture(reader.result as string);
      setFeedback(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Full name is required.' });
      return;
    }

    if (!email.trim()) {
      setFeedback({ type: 'error', message: 'Email address is required.' });
      return;
    }

    if (showPasswordSection && newPassword) {
      if (newPassword.length < 6) {
        setFeedback({ type: 'error', message: 'New password must be at least 6 characters.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setFeedback({ type: 'error', message: 'New password and confirmation do not match.' });
        return;
      }
      if (!currentPassword) {
        setFeedback({ type: 'error', message: 'Please enter your current password to set a new password.' });
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        profile_picture: profilePicture
      };

      if (showPasswordSection && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await fetchApi('/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      // Update AuthContext state and localStorage
      updateUser({
        name: res.user?.name || name.trim(),
        email: res.user?.email || email.trim().toLowerCase(),
        phone: res.user?.phone || phone.trim(),
        profile_picture: res.user?.profile_picture || profilePicture
      });

      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);

      // Close modal after brief feedback
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Store Administrator',
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          desc: 'Full operational control, management reports, purchases & user governance.'
        };
      case 'supplier':
        return {
          label: 'Supplier / Vendor',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          desc: 'Manage purchase orders, logistics updates & catalog supply lines.'
        };
      case 'staff':
      default:
        return {
          label: 'Front Counter Staff',
          classes: 'bg-blue-50 text-blue-700 border-blue-200',
          desc: 'Terminal POS cashiering, daily shifts, customer directory & sales receipts.'
        };
    }
  };

  const roleInfo = getRoleBadge(user.role);

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">My Profile & Account</h3>
              <p className="text-[11px] text-slate-400">Update personal information, avatar, and security credentials</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {feedback.type === 'success' ? <Check size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="relative group shrink-0">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-900 text-white font-black text-2xl flex items-center justify-center uppercase border-2 border-white shadow-md">
                  {name.charAt(0) || user.name.charAt(0) || 'U'}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-opacity"
                title="Upload Photo"
              >
                <Camera size={18} />
                <span>Upload</span>
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Camera size={13} className="text-blue-600" />
                  <span>Choose Photo</span>
                </button>

                {profilePicture && (
                  <button
                    type="button"
                    onClick={() => setProfilePicture(null)}
                    className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    title="Remove Profile Picture"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Presets */}
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Or choose a preset avatar:</div>
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfilePicture(url)}
                      className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${
                        profilePicture === url ? 'border-blue-600 ring-2 ring-blue-500/20 scale-105' : 'border-transparent'
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Role Status Ribbon */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <ShieldCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Assigned Role:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${roleInfo.classes}`}>
                  {roleInfo.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal font-medium">
                {roleInfo.desc}
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ama Serwaa"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@ummislane.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 24 123 4567"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security & Password section */}
          <div className="border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700 hover:text-blue-600 transition py-1"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound size={14} className="text-slate-400" />
                Change Password
              </span>
              <span className="text-[11px] font-bold text-blue-600">
                {showPasswordSection ? 'Cancel' : '+ Set New Password'}
              </span>
            </button>

            {showPasswordSection && (
              <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Current Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">New Password</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs uppercase tracking-wider transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
