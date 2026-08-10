fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'staff@staff.com', password: 'Password' })
}).then(r => r.text()).then(t => console.log('RESPONSE:', t)).catch(console.error);
