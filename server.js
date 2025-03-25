// server.js
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure session middleware
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ----- DATABASE SETUP ----- //
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
  // Users table – storing username, password, email, balance, assets, and admin flag
  db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT,
      balance REAL,
      stocks TEXT,      -- JSON string (e.g., {"AAPL":2})
      cryptos TEXT,     -- JSON string (e.g., {"BTC":0.5})
      admin INTEGER DEFAULT 0
  )`);
  // Tickets table for support/inquiries
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      status TEXT,      -- open, in-progress, completed, canceled
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Stocks table – fake stocks with a humorous description
  db.run(`CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT,
      name TEXT,
      price REAL,
      description TEXT
  )`);
  // Cryptos table – similar to stocks but for cryptocurrencies
  db.run(`CREATE TABLE IF NOT EXISTS cryptos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT,
      name TEXT,
      price REAL,
      description TEXT
  )`);
  // Insert sample stocks if table is empty
  db.all("SELECT COUNT(*) AS count FROM stocks", (err, rows) => {
      if (rows[0].count == 0) {
          let stmt = db.prepare("INSERT INTO stocks (symbol, name, price, description) VALUES (?, ?, ?, ?)");
          stmt.run("AAPL", "Apple Inc.", 150, "Apple Inc. – Think Different, but invest wisely!");
          stmt.run("GOOGL", "Alphabet Inc.", 2800, "Alphabet: Search your way to success!");
          stmt.run("AMZN", "Amazon.com Inc.", 3300, "Amazon: The world’s biggest online marketplace!");
          stmt.finalize();
      }
  });
  // Insert sample cryptos if table is empty
  db.all("SELECT COUNT(*) AS count FROM cryptos", (err, rows) => {
      if (rows[0].count == 0) {
          let stmt = db.prepare("INSERT INTO cryptos (symbol, name, price, description) VALUES (?, ?, ?, ?)");
          stmt.run("BTC", "Bitcoin", 30000, "Bitcoin: The original cryptocurrency!");
          stmt.run("ETH", "Ethereum", 2000, "Ethereum: Fueling decentralized apps!");
          stmt.run("DOGE", "Dogecoin", 0.2, "Dogecoin: Much wow, very invest!");
          stmt.finalize();
      }
  });
});

// Middleware to check if a user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
      return next();
  }
  res.redirect('/');
}

// ----- ROUTES ----- //
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/game', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});
app.get('/settings', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});
app.get('/trade', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'trade.html'));
});
app.get('/tickets', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tickets.html'));
});
app.get('/admin', isAuthenticated, (req, res) => {
  // Only allow admin users access
  db.get("SELECT admin FROM users WHERE id = ?", [req.session.userId], (err, row) => {
      if (row && row.admin == 1) {
          res.sendFile(path.join(__dirname, 'public', 'admin.html'));
      } else {
          res.send("Access Denied");
      }
  });
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ----- API ENDPOINTS ----- //
// Registration endpoint – checks username uniqueness, matching passwords, and gives new players $5,000 plus one random stock and one random crypto.
app.post('/api/register', (req, res) => {
  const { username, password, confirmPassword, email } = req.body;
  if (password !== confirmPassword) {
      return res.json({ success: false, message: "Passwords do not match." });
  }
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (row) {
          return res.json({ success: false, message: "Username already taken." });
      } else {
          // Get one random stock
          db.all("SELECT * FROM stocks ORDER BY RANDOM() LIMIT 1", (err, stockRows) => {
              let initialStocks = {};
              if (stockRows.length > 0) {
                  initialStocks[stockRows[0].symbol] = 1;
              }
              // Get one random crypto
              db.all("SELECT * FROM cryptos ORDER BY RANDOM() LIMIT 1", (err, cryptoRows) => {
                  let initialCryptos = {};
                  if (cryptoRows.length > 0) {
                      initialCryptos[cryptoRows[0].symbol] = 1;
                  }
                  db.run("INSERT INTO users (username, password, email, balance, stocks, cryptos) VALUES (?, ?, ?, ?, ?, ?)",
                    [username, password, email, 5000, JSON.stringify(initialStocks), JSON.stringify(initialCryptos)],
                    function(err) {
                      if (err) {
                          return res.json({ success: false, message: "Error creating account." });
                      }
                      req.session.userId = this.lastID;
                      res.json({ success: true });
                  });
              });
          });
      }
  });
});

// Login endpoint – validates credentials.
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
      if (row) {
          req.session.userId = row.id;
          res.json({ success: true });
      } else {
          res.json({ success: false, message: "Invalid credentials." });
      }
  });
});

// Get current user info (username, balance, assets)
app.get('/api/user', isAuthenticated, (req, res) => {
  db.get("SELECT username, balance, stocks, cryptos FROM users WHERE id = ?", [req.session.userId], (err, row) => {
      res.json(row);
  });
});

// Get list of fake stocks
app.get('/api/stocks', isAuthenticated, (req, res) => {
  db.all("SELECT * FROM stocks", (err, rows) => {
      res.json(rows);
  });
});

// Get list of fake cryptos
app.get('/api/cryptos', isAuthenticated, (req, res) => {
  db.all("SELECT * FROM cryptos", (err, rows) => {
      res.json(rows);
  });
});

// Trading endpoint – allows a player to trade an asset (stock or crypto) with another player.
// (A production version would include many more validations.)
app.post('/api/trade', isAuthenticated, (req, res) => {
  const { toUser, assetType, symbol, amount, price } = req.body;
  db.get("SELECT id, balance, stocks, cryptos FROM users WHERE username = ?", [toUser], (err, recipient) => {
      if (!recipient) {
          return res.json({ success: false, message: "Recipient not found." });
      }
      db.get("SELECT balance, stocks, cryptos FROM users WHERE id = ?", [req.session.userId], (err, sender) => {
          if (assetType === 'stock') {
              let senderStocks = JSON.parse(sender.stocks);
              if (!senderStocks[symbol] || senderStocks[symbol] < amount) {
                  return res.json({ success: false, message: "Insufficient stock." });
              }
              // Update sender’s and recipient’s stock holdings
              senderStocks[symbol] -= amount;
              let recipientStocks = recipient.stocks ? JSON.parse(recipient.stocks) : {};
              recipientStocks[symbol] = (recipientStocks[symbol] || 0) + amount;
              let totalPrice = amount * price;
              db.run("UPDATE users SET stocks = ?, balance = balance + ? WHERE id = ?",
                  [JSON.stringify(senderStocks), totalPrice, req.session.userId]);
              db.run("UPDATE users SET stocks = ?, balance = balance - ? WHERE id = ?",
                  [JSON.stringify(recipientStocks), totalPrice, recipient.id]);
              res.json({ success: true });
          } else if (assetType === 'crypto') {
              let senderCryptos = JSON.parse(sender.cryptos);
              if (!senderCryptos[symbol] || senderCryptos[symbol] < amount) {
                  return res.json({ success: false, message: "Insufficient crypto." });
              }
              senderCryptos[symbol] -= amount;
              let recipientCryptos = recipient.cryptos ? JSON.parse(recipient.cryptos) : {};
              recipientCryptos[symbol] = (recipientCryptos[symbol] || 0) + amount;
              let totalPrice = amount * price;
              db.run("UPDATE users SET cryptos = ?, balance = balance + ? WHERE id = ?",
                  [JSON.stringify(senderCryptos), totalPrice, req.session.userId]);
              db.run("UPDATE users SET cryptos = ?, balance = balance - ? WHERE id = ?",
                  [JSON.stringify(recipientCryptos), totalPrice, recipient.id]);
              res.json({ success: true });
          }
      });
  });
});

// Submit a support ticket
app.post('/api/ticket', isAuthenticated, (req, res) => {
  const { message } = req.body;
  db.run("INSERT INTO tickets (user_id, status, message) VALUES (?, 'open', ?)", [req.session.userId, message], function(err) {
      if (err) {
          return res.json({ success: false, message: "Error submitting ticket." });
      }
      res.json({ success: true });
  });
});

// Fetch tickets – if the user is admin, show all tickets; otherwise only the user’s own.
app.get('/api/tickets', isAuthenticated, (req, res) => {
  db.get("SELECT admin FROM users WHERE id = ?", [req.session.userId], (err, row) => {
      if (row.admin == 1) {
          db.all("SELECT tickets.*, users.username FROM tickets JOIN users ON tickets.user_id = users.id", (err, rows) => {
              res.json(rows);
          });
      } else {
          db.all("SELECT * FROM tickets WHERE user_id = ?", [req.session.userId], (err, rows) => {
              res.json(rows);
          });
      }
  });
});

// ----- REAL-TIME PRICE UPDATES ----- //
// Simulate news events that affect stock and crypto prices.
function updateAssetPrices() {
  // Update stocks: adjust price by a random percent (-5% to +5%)
  db.all("SELECT * FROM stocks", (err, stocks) => {
      stocks.forEach(stock => {
          let changePercent = (Math.random() - 0.5) * 0.1;
          let newPrice = stock.price * (1 + changePercent);
          db.run("UPDATE stocks SET price = ? WHERE id = ?", [newPrice, stock.id]);
      });
  });
  // Update cryptos: adjust price by a random percent (-10% to +10%)
  db.all("SELECT * FROM cryptos", (err, cryptos) => {
      cryptos.forEach(crypto => {
          let changePercent = (Math.random() - 0.5) * 0.2;
          let newPrice = crypto.price * (1 + changePercent);
          db.run("UPDATE cryptos SET price = ? WHERE id = ?", [newPrice, crypto.id]);
      });
  });
}
// Update every 60 seconds
setInterval(updateAssetPrices, 60000);

// ----- SOCKET.IO FOR ONLINE PLAYERS ----- //
let onlineUsers = {};

io.on('connection', (socket) => {
  socket.on('userOnline', (data) => {
      onlineUsers[socket.id] = data.username;
      io.emit('onlineUsers', Object.values(onlineUsers));
  });
  socket.on('disconnect', () => {
      delete onlineUsers[socket.id];
      io.emit('onlineUsers', Object.values(onlineUsers));
  });
});

// ----- START THE SERVER ----- //
server.listen(3000, () => {
  console.log('Server running on port 3000');
});