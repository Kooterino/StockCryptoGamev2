document.addEventListener('DOMContentLoaded', function() {
    // Toggle mobile menu
    const menuBtn = document.getElementById('menuBtn');
    const menu = document.getElementById('menu');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            menu.classList.toggle('hidden');
        });
    }

    // ----- LOGIN FORM ----- //
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            }).then(res => res.json()).then(data => {
                if (data.success) {
                    window.location.href = '/game';
                } else {
                    alert(data.message);
                }
            });
        });
    }

    // ----- REGISTRATION FORM ----- //
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, confirmPassword })
            }).then(res => res.json()).then(data => {
                if (data.success) {
                    window.location.href = '/game';
                } else {
                    alert(data.message);
                }
            });
        });
    }

    // ----- FETCH USER INFO ----- //
    fetch('/api/user').then(res => res.json()).then(data => {
        const userInfoDiv = document.getElementById('userInfo');
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `${data.username} | $${data.balance.toFixed(2)}`;
        }
    });

    // ----- DISPLAY STOCKS WITH CHART PREVIEW ----- //
    if (document.getElementById('stocksList')) {
        fetch('/api/stocks').then(res => res.json()).then(stocks => {
            const stocksList = document.getElementById('stocksList');
            stocks.forEach(stock => {
                const div = document.createElement('div');
                div.className = 'stock-item';
                div.innerHTML = `<strong>${stock.symbol}</strong> - $${stock.price.toFixed(2)}<br>${stock.description}<br>
                                 <canvas id="chart-${stock.id}" width="150" height="75"></canvas>`;
                div.addEventListener('click', () => {
                    // This demo simply shows an alert; a full version would show a detailed view.
                    alert('Detailed chart view not implemented in this demo.');
                });
                stocksList.appendChild(div);
                // Create a small preview chart with random data simulating price history
                const ctx = document.getElementById(`chart-${stock.id}`).getContext('2d');
                const dataPoints = Array.from({ length: 10 }, () => Math.random() * stock.price);
                const trendColor = dataPoints[dataPoints.length - 1] >= dataPoints[0] ? 'green' : 'red';
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: dataPoints.map((_, i) => i),
                        datasets: [{
                            data: dataPoints,
                            borderColor: trendColor,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { display: false }, y: { display: false } },
                        elements: { point: { radius: 0 } },
                        plugins: { legend: { display: false } }
                    }
                });
            });
        });
    }

    // ----- DISPLAY CRYPTOS WITH CHART PREVIEW ----- //
    if (document.getElementById('cryptosList')) {
        fetch('/api/cryptos').then(res => res.json()).then(cryptos => {
            const cryptosList = document.getElementById('cryptosList');
            cryptos.forEach(crypto => {
                const div = document.createElement('div');
                div.className = 'crypto-item';
                div.innerHTML = `<strong>${crypto.symbol}</strong> - $${crypto.price.toFixed(2)}<br>${crypto.description}<br>
                                 <canvas id="crypto-chart-${crypto.id}" width="150" height="75"></canvas>`;
                div.addEventListener('click', () => {
                    alert('Detailed crypto chart view not implemented in this demo.');
                });
                cryptosList.appendChild(div);
                const ctx = document.getElementById(`crypto-chart-${crypto.id}`).getContext('2d');
                const dataPoints = Array.from({ length: 10 }, () => Math.random() * crypto.price);
                const trendColor = dataPoints[dataPoints.length - 1] >= dataPoints[0] ? 'green' : 'red';
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: dataPoints.map((_, i) => i),
                        datasets: [{
                            data: dataPoints,
                            borderColor: trendColor,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { display: false }, y: { display: false } },
                        elements: { point: { radius: 0 } },
                        plugins: { legend: { display: false } }
                    }
                });
            });
        });
    }

    // ----- TRADE FORM HANDLING ----- //
    const tradeBtn = document.getElementById('tradeBtn');
    if (tradeBtn) {
        tradeBtn.addEventListener('click', () => {
            const toUser = document.getElementById('recipient').value;
            const assetType = document.getElementById('assetType').value;
            const symbol = document.getElementById('symbol').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const price = parseFloat(document.getElementById('price').value);
            fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toUser, assetType, symbol, amount, price })
            }).then(res => res.json()).then(data => {
                document.getElementById('tradeStatus').innerText = data.message || "Trade completed!";
            });
        });
        // Populate the online players list using Socket.IO
        const recipientSelect = document.getElementById('recipient');
        const socket = io();
        // Send the current username to the socket server
        socket.emit('userOnline', { username: document.getElementById('userInfo').innerText.split('|')[0].trim() });
        socket.on('onlineUsers', (users) => {
            recipientSelect.innerHTML = '';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.innerText = user;
                recipientSelect.appendChild(option);
            });
        });
    }

    // ----- TICKET SUBMISSION ----- //
    const submitTicketBtn = document.getElementById('submitTicketBtn');
    if (submitTicketBtn) {
        submitTicketBtn.addEventListener('click', () => {
            const message = document.getElementById('ticketMessage').value;
            fetch('/api/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            }).then(res => res.json()).then(data => {
                alert(data.message || "Ticket submitted!");
            });
        });
    }

    // ----- DISPLAY TICKETS (User & Admin) ----- //
    if (document.getElementById('ticketsList')) {
        fetch('/api/tickets').then(res => res.json()).then(tickets => {
            const ticketsList = document.getElementById('ticketsList');
            tickets.forEach(ticket => {
                const div = document.createElement('div');
                div.className = 'ticket';
                div.innerHTML = `<strong>ID:</strong> ${ticket.id} - <strong>Status:</strong> ${ticket.status}<br>
                                 <strong>Message:</strong> ${ticket.message}`;
                ticketsList.appendChild(div);
            });
        });
    }
    if (document.getElementById('adminTicketsList')) {
        fetch('/api/tickets').then(res => res.json()).then(tickets => {
            const adminTicketsList = document.getElementById('adminTicketsList');
            tickets.forEach(ticket => {
                const div = document.createElement('div');
                div.className = 'ticket';
                div.innerHTML = `<strong>ID:</strong> ${ticket.id} - <strong>User:</strong> ${ticket.username} - <strong>Status:</strong> ${ticket.status}<br>
                                 <strong>Message:</strong> ${ticket.message}`;
                adminTicketsList.appendChild(div);
            });
        });
    }

    // ----- SETTINGS: Theme Toggle ----- //
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            document.body.className = themeToggle.value;
        });
    }
});