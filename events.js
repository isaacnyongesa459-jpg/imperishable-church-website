// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// EVENTS PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // GET HTML ELEMENTS
    // ========================================

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");

    const eventsGrid =
        document.getElementById("eventsGrid");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    hamburger.addEventListener("click", (event) => {

        event.stopPropagation();

        dropdownMenu.classList.toggle("show");

        const isOpen =
            dropdownMenu.classList.contains("show");

        hamburger.setAttribute(
            "aria-expanded",
            isOpen
        );


        // Change hamburger icon

        const icon =
            hamburger.querySelector("i");

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

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

            const icon =
                hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");
        }

    });


    // ========================================
    // CLOSE MENU AFTER CLICKING A LINK
    // ========================================

    const menuLinks =
        document.querySelectorAll(".dropdown-item");

    menuLinks.forEach((link) => {

        link.addEventListener("click", () => {

            dropdownMenu.classList.remove("show");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

            const icon =
                hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");

        });

    });


    // ========================================
    // CHURCH EVENTS
    // ========================================

    const events = [

        {
            date: "25",
            month: "OCT",
            category: "Sunday Service",

            title: "Sunday Worship Service",

            description:
                "Come and worship with us as we gather together in fellowship, prayer and the Word of God.",

            time: "9:00 AM - 12:00 PM",

            location:
                "Imperishable Crown Bible Baptist Church",

            image:
                "images/event-sunday.jpg"
        },


        {
            date: "31",
            month: "OCT",
            category: "Fellowship",

            title: "Church Fellowship",

            description:
                "Join us for a special time of fellowship, encouragement and spiritual growth with fellow believers.",

            time: "5:00 PM - 7:00 PM",

            location:
                "Church Grounds",

            image:
                "images/event-fellowship.jpg"
        },


        {
            date: "08",
            month: "NOV",
            category: "Bible Study",

            title: "Bible Study Gathering",

            description:
                "A special opportunity to study God's Word together and grow deeper in our understanding of Scripture.",

            time: "4:00 PM - 6:00 PM",

            location:
                "Church Hall",

            image:
                "images/event-bible-study.jpg"
        },


        {
            date: "15",
            month: "NOV",
            category: "Worship",

            title: "Praise & Worship Sunday",

            description:
                "Experience a special worship service filled with praise, prayer and the preaching of God's Word.",

            time: "9:00 AM - 12:00 PM",

            location:
                "Imperishable Crown Bible Baptist Church",

            image:
                "images/event-worship.jpg"
        },


        {
            date: "22",
            month: "NOV",
            category: "Youth",

            title: "Youth Fellowship",

            description:
                "A gathering designed to encourage young people in their faith, relationships and walk with Christ.",

            time: "3:00 PM - 5:00 PM",

            location:
                "Church Hall",

            image:
                "images/event-youth.jpg"
        },


        {
            date: "29",
            month: "NOV",
            category: "Special Event",

            title: "Thanksgiving Service",

            description:
                "Let us come together to give thanks to God for His faithfulness, provision and blessings.",

            time: "9:00 AM - 12:00 PM",

            location:
                "Imperishable Crown Bible Baptist Church",

            image:
                "images/event-thanksgiving.jpg"
        }

    ];


    // ========================================
    // DISPLAY EVENTS
    // ========================================

    function displayEvents() {

        eventsGrid.innerHTML = "";


        // Check if there are no events

        if (events.length === 0) {

            eventsGrid.innerHTML = `

                <div class="no-events">

                    <i class="fas fa-calendar-xmark"></i>

                    <h3>No Upcoming Events</h3>

                    <p>
                        Please check back soon for
                        upcoming church events.
                    </p>

                </div>

            `;

            return;
        }


        // Create event cards

        events.forEach((event) => {

            const eventCard =
                document.createElement("article");

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

                        <span class="month">
                            ${event.month}
                        </span>

                        <span class="day">
                            ${event.date}
                        </span>

                    </div>

                </div>


                <div class="event-content">

                    <span class="event-category">
                        ${event.category}
                    </span>

                    <h3>
                        ${event.title}
                    </h3>

                    <p class="event-description">
                        ${event.description}
                    </p>


                    <div class="event-info">

                        <p>
                            <i class="fas fa-clock"></i>
                            ${event.time}
                        </p>

                        <p>
                            <i class="fas fa-location-dot"></i>
                            ${event.location}
                        </p>

                    </div>


                    <a
                        href="contact.html"
                        class="event-button"
                    >
                        Learn More
                        <i class="fas fa-arrow-right"></i>
                    </a>

                </div>

            `;


            eventsGrid.appendChild(eventCard);

        });

    }


    // ========================================
    // INITIALIZE EVENTS
    // ========================================

    displayEvents();

});