/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   EVENTS PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // GET HTML ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const eventsGrid = document.getElementById("eventsGrid");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    hamburger.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdownMenu.classList.toggle("show");

        const isOpen = dropdownMenu.classList.contains("show");
        hamburger.setAttribute("aria-expanded", isOpen);

        const icon = hamburger.querySelector("i");
        if (isOpen) {
            icon.classList.remove("fa-bars");
            icon.classList.add("fa-xmark");
        } else {
            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        }
    });


    // ========================================
    // CLOSE MENU WHEN CLICKING OUTSIDE
    // ========================================

    document.addEventListener("click", (event) => {
        if (
            !dropdownMenu.contains(event.target) &&
            !hamburger.contains(event.target)
        ) {
            dropdownMenu.classList.remove("show");
            hamburger.setAttribute("aria-expanded", "false");

            const icon = hamburger.querySelector("i");
            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        }
    });


    // ========================================
    // CLOSE MENU AFTER CLICKING A LINK
    // ========================================

    const menuLinks = document.querySelectorAll(".dropdown-item");
    menuLinks.forEach((link) => {
        link.addEventListener("click", () => {
            dropdownMenu.classList.remove("show");
            hamburger.setAttribute("aria-expanded", "false");

            const icon = hamburger.querySelector("i");
            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        });
    });


    // ========================================
    // CHURCH EVENTS
    // ✅ Images are now "1.png", "2.png", ... (same folder)
    // ✅ Added detailed info for the modal
    // ========================================

    const events = [
        {
            date: "25",
            month: "OCT",
            category: "Sunday Service",
            title: "Sunday Worship Service",
            description:
                "Come and worship with us as we gather together in fellowship, prayer and the Word of God.",
            details:
                "Join us every Sunday morning for a Spirit-filled worship service. We begin with praise and worship, followed by a powerful message from God's Word. Children's ministry is available. All are welcome — come as you are and leave encouraged!",
            time: "9:00 AM - 12:00 PM",
            location: "Imperishable Crown Bible Baptist Church",
            image: "17.png"
        },
        {
            date: "31",
            month: "OCT",
            category: "Fellowship",
            title: "Church Fellowship",
            description:
                "Join us for a special time of fellowship, encouragement and spiritual growth with fellow believers.",
            details:
                "An evening of food, testimonies, and warm fellowship. Bring a friend and let's build each other up in love. We'll share a meal together and pray for one another.",
            time: "5:00 PM - 7:00 PM",
            location: "Church Grounds",
            image: "2.png"
        },
        {
            date: "08",
            month: "NOV",
            category: "Bible Study",
            title: "Bible Study Gathering",
            description:
                "A special opportunity to study God's Word together and grow deeper in our understanding of Scripture.",
            details:
                "This week we continue our verse-by-verse study of the book of Romans. Bring your Bible, a notebook, and questions. Perfect for both new believers and seasoned students of the Word.",
            time: "4:00 PM - 6:00 PM",
            location: "Church Hall",
            image: "3.png"
        },
        {
            date: "15",
            month: "NOV",
            category: "Worship",
            title: "Praise & Worship Sunday",
            description:
                "Experience a special worship service filled with praise, prayer and the preaching of God's Word.",
            details:
                "A special Sunday dedicated to extended worship, prayer, and thanksgiving. Our choir and worship team will lead us into God's presence. Come expectant!",
            time: "9:00 AM - 12:00 PM",
            location: "Imperishable Crown Bible Baptist Church",
            image: "4.png"
        },
        {
            date: "22",
            month: "NOV",
            category: "Youth",
            title: "Youth Fellowship",
            description:
                "A gathering designed to encourage young people in their faith, relationships and walk with Christ.",
            details:
                "Youth from all walks of life gather for games, testimonies, and a short, relevant message. A safe place to grow in faith, make friends, and ask real questions about life and God.",
            time: "3:00 PM - 5:00 PM",
            location: "Church Hall",
            image: "5.png"
        },
        {
            date: "29",
            month: "NOV",
            category: "Special Event",
            title: "Thanksgiving Service",
            description:
                "Let us come together to give thanks to God for His faithfulness, provision and blessings.",
            details:
                "A special service to reflect on God's goodness over the year. We'll have testimonies, special music, and a thanksgiving message. Come and share what God has done for you!",
            time: "9:00 AM - 12:00 PM",
            location: "Imperishable Crown Bible Baptist Church",
            image: "6.png"
        }
    ];


    // ========================================
    // DISPLAY EVENTS
    // ========================================

    function displayEvents() {
        eventsGrid.innerHTML = "";

        if (events.length === 0) {
            eventsGrid.innerHTML = `
                <div class="no-events">
                    <i class="fas fa-calendar-xmark"></i>
                    <h3>No Upcoming Events</h3>
                    <p>Please check back soon for upcoming church events.</p>
                </div>
            `;
            return;
        }

        events.forEach((event, index) => {
            const eventCard = document.createElement("article");
            eventCard.className = "event-card";

            eventCard.innerHTML = `
                <div class="event-image">
                    <img
                        src="${event.image}"
                        alt="${event.title}"
                        loading="lazy"
                        onerror="this.src='https://via.placeholder.com/600x400?text=Church+Event'"
                    >
                    <div class="event-date">
                        <span class="month">${event.month}</span>
                        <span class="day">${event.date}</span>
                    </div>
                </div>

                <div class="event-content">
                    <span class="event-category">${event.category}</span>
                    <h3>${event.title}</h3>
                    <p class="event-description">${event.description}</p>

                    <div class="event-info">
                        <p><i class="fas fa-clock"></i> ${event.time}</p>
                        <p><i class="fas fa-location-dot"></i> ${event.location}</p>
                    </div>

                    <button class="event-button" data-index="${index}">
                        Learn More
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            `;

            // Clicking the image also opens details
            eventCard.querySelector(".event-image").addEventListener("click", () => {
                openEventModal(events[index]);
            });

            eventsGrid.appendChild(eventCard);
        });

        // Attach click handlers to the Learn More buttons
        document.querySelectorAll(".event-button").forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = btn.getAttribute("data-index");
                openEventModal(events[idx]);
            });
        });
    }


    // ========================================
    // EVENT DETAILS MODAL
    // ========================================

    function openEventModal(event) {
        // Build modal if not already there
        let modal = document.getElementById("eventModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "eventModal";
            modal.className = "event-modal";
            modal.innerHTML = `
                <div class="event-modal-overlay"></div>
                <div class="event-modal-content">
                    <button class="event-modal-close" aria-label="Close">&times;</button>
                    <img class="event-modal-img" src="" alt="">
                    <div class="event-modal-body">
                        <span class="event-category modal-category"></span>
                        <h2 class="modal-title"></h2>
                        <p class="modal-details"></p>
                        <div class="event-info">
                            <p><i class="fas fa-calendar"></i> <span class="modal-date"></span></p>
                            <p><i class="fas fa-clock"></i> <span class="modal-time"></span></p>
                            <p><i class="fas fa-location-dot"></i> <span class="modal-location"></span></p>
                        </div>
                        <a href="contact.html" class="event-button">
                            Contact Us <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector(".event-modal-overlay").addEventListener("click", closeModal);
            modal.querySelector(".event-modal-close").addEventListener("click", closeModal);
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closeModal();
            });
        }

        // Fill in details
        modal.querySelector(".event-modal-img").src = event.image;
        modal.querySelector(".event-modal-img").alt = event.title;
        modal.querySelector(".modal-category").textContent = event.category;
        modal.querySelector(".modal-title").textContent = event.title;
        modal.querySelector(".modal-details").textContent = event.details || event.description;
        modal.querySelector(".modal-date").textContent = `${event.month} ${event.date}`;
        modal.querySelector(".modal-time").textContent = event.time;
        modal.querySelector(".modal-location").textContent = event.location;

        modal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        const modal = document.getElementById("eventModal");
        if (modal) {
            modal.classList.remove("show");
            document.body.style.overflow = "";
        }
    }


    // ========================================
    // INITIALIZE EVENTS
    // ========================================

    displayEvents();
});