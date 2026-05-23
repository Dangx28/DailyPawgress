// ── auth.js  (login.html) ──

function switchTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err  = document.getElementById('login-error');

  if (!user || !pass) { err.textContent = 'Please fill in all fields.'; return; }

  const stored = JSON.parse(localStorage.getItem('dp_users') || '{}');
  if (!stored[user]) { err.textContent = 'Username not found.'; return; }
  if (stored[user] !== pass) { err.textContent = 'Incorrect password.'; return; }

  localStorage.setItem('dp_loggedIn', user);
  window.location.href = 'index.html';
}

function handleSignup() {
  const user    = document.getElementById('signup-user').value.trim();
  const pass    = document.getElementById('signup-pass').value;
  const confirm = document.getElementById('signup-confirm').value;
  const err     = document.getElementById('signup-error');

  if (!user || !pass || !confirm) { err.textContent = 'Please fill in all fields.'; return; }
  if (pass !== confirm)           { err.textContent = 'Passwords do not match.'; return; }
  if (pass.length < 4)            { err.textContent = 'Password must be at least 4 characters.'; return; }

  const stored = JSON.parse(localStorage.getItem('dp_users') || '{}');
  if (stored[user]) { err.textContent = 'Username already taken.'; return; }

  stored[user] = pass;
  localStorage.setItem('dp_users', JSON.stringify(stored));
  localStorage.setItem('dp_loggedIn', user);
  window.location.href = 'index.html';
}

// Redirect if already logged in
if (localStorage.getItem('dp_loggedIn')) {
  window.location.href = 'index.html';
}
