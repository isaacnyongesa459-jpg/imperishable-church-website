// Hamburger menu functionality
const hamburger = document.getElementById('hamburger');
const dropdownMenu = document.getElementById('dropdownMenu');

// Toggle dropdown menu when hamburger is clicked
if (hamburger && dropdownMenu) {
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!hamburger.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove('active');
        }
    });

    // Close dropdown when a link is clicked
    document.querySelectorAll('.dropdown-item').forEach(link => {
        link.addEventListener('click', () => {
            dropdownMenu.classList.remove('active');
        });
    });
}

// Events data for events.html
if (document.getElementById('eventsGrid')) {
    const events = [
        {
            title: "Sunday Worship Service",
            date: "Every Sunday",
            time: "8:00 AM & 10:30 AM",
            description: "Join us for powerful worship and inspiring message"
        },
        {
            title: "Youth Conference 2024",
            date: "December 15-17, 2024",
            time: "9:00 AM - 5:00 PM",
            description: "Empowering the next generation with faith and purpose"
        },
        {
            title: "Christmas Celebration",
            date: "December 24, 2024",
            time: "6:00 PM",
            description: "Special Christmas Eve service with choir performance"
        },
        {
            title: "Marriage Seminar",
            date: "January 10-11, 2025",
            time: "6:00 PM",
            description: "Building stronger Christian marriages"
        },
        {
            title: "Community Outreach",
            date: "January 25, 2025",
            time: "8:00 AM",
            description: "Food distribution and community service day"
        },
        {
            title: "Easter Celebration",
            date: "April 5-7, 2025",
            time: "Various Times",
            description: "Three days of celebration and worship"
        }
    ];

    const eventsGrid = document.getElementById('eventsGrid');
    eventsGrid.innerHTML = events.map(event => `
        <div class="event-card">
            <div class="event-info">
                <div class="event-date"><i class="far fa-calendar-alt"></i> ${event.date} at ${event.time}</div>
                <h3>${event.title}</h3>
                <p>${event.description}</p>
            </div>
        </div>
    `).join('');
}

// Donation functionality (for donate.html)
if (document.getElementById('paypalBtn')) {
    let selectedAmount = 20;
    const amountBtns = document.querySelectorAll('.amount-btn');
    const customAmount = document.getElementById('customAmount');

    amountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            amountBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAmount = parseInt(btn.dataset.amount);
            if (customAmount) customAmount.value = '';
        });
    });

    if (customAmount) {
        customAmount.addEventListener('input', (e) => {
            amountBtns.forEach(b => b.classList.remove('active'));
            if (e.target.value) {
                selectedAmount = parseFloat(e.target.value);
            }
        });
    }

    document.getElementById('paypalBtn').addEventListener('click', () => {
        let amount = selectedAmount;
        if (customAmount && customAmount.value && parseFloat(customAmount.value) > 0) {
            amount = parseFloat(customAmount.value);
        }
        
        if (amount && amount > 0) {
            showModal('PayPal Donation', `Thank you for your donation of $${amount}. You will be redirected to PayPal to complete your payment.`);
            // Replace YOUR_BUSINESS_EMAIL with your actual PayPal business email
             window.location.href = `https://www.paypal.com/qrcodes/p2pqrc/B3LXYZ56QQEZ4/donate?business=YOUR_BUSINESS_EMAIL&amount=${amount}&currency_code=USD`;
        } else {
            alert('Please enter a valid donation amount');
        }
    });

    // M-Pesa functionality
    let selectedMpesaAmount = 500;
    const mpesaBtns = document.querySelectorAll('.amount-btn-mpesa');
    const customMpesaAmount = document.getElementById('customMpesaAmount');

    mpesaBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mpesaBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMpesaAmount = parseInt(btn.dataset.amount);
            if (customMpesaAmount) customMpesaAmount.value = '';
        });
    });

    if (customMpesaAmount) {
        customMpesaAmount.addEventListener('input', (e) => {
            mpesaBtns.forEach(b => b.classList.remove('active'));
            if (e.target.value) {
                selectedMpesaAmount = parseFloat(e.target.value);
            }
        });
    }

    document.getElementById('mpesaBtn').addEventListener('click', () => {
        let amount = selectedMpesaAmount;
        if (customMpesaAmount && customMpesaAmount.value && parseFloat(customMpesaAmount.value) > 0) {
            amount = parseFloat(customMpesaAmount.value);
        }
        
        if (amount && amount > 0) {
            showModal('M-Pesa Donation', `Thank you for your donation of KES ${amount}. Please follow the Paybill instructions below to complete your payment.\n\nPaybill Number: 123456\nAccount Number: CHURCH2024`);
        } else {
            alert('Please enter a valid donation amount');
        }
    });
}

// Contact form submission
if (document.getElementById('contactForm')) {
    document.getElementById('contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showModal('Message Sent', 'Thank you for reaching out! We will get back to you soon.');
        e.target.reset();
    });
}

// Modal functions
function showModal(title, message) {
    let modal = document.getElementById('globalModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--success); margin-bottom: 1rem;"></i>
                <h3 id="modalTitle">Thank You!</h3>
                <p id="modalMessage"></p>
                <button onclick="closeModal()" class="btn btn-primary" style="margin-top: 1rem;">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    modal.style.display = 'flex';
}

window.closeModal = function() {
    const modal = document.getElementById('globalModal');
    if (modal) modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('globalModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'white';
        navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
        navbar.style.background = 'white';
    }
});

// Animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.service-card, .donation-card, .event-card, .feature-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
});