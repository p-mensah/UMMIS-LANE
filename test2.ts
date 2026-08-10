import bcrypt from 'bcryptjs';

const adminHash = '$2b$10$u1JzF3SYwpEBTffWfiWnYOB/vHujPiD6HXgezgcUJejp7WNcvkz/i';
console.log('admin Password:', bcrypt.compareSync('Password', adminHash));

const staffHash = '$2b$10$ewVPnST4ARpWXgbf80sgg.XOCgd6wB.PpV3qT0R9Mwui8fD2iRib.';
console.log('staff Password:', bcrypt.compareSync('Password', staffHash));
