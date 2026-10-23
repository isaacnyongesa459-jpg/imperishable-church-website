/* ========================================
IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
WELCOME PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {

const joinButton = document.getElementById("joinButton");


/* ========================================
   JOIN BUTTON
======================================== */

if (joinButton) {

    joinButton.addEventListener("click", (event) => {

        /*
            Allow the normal link to work.

            A small delay gives the button's
            click animation time to appear.
        */

        event.preventDefault();

        const destination = joinButton.getAttribute("href");

        joinButton.classList.add("clicked");

        setTimeout(() => {

            window.location.href = destination;

        }, 180);

    });

}


/* ========================================
   PREVENT ACCIDENTAL DOUBLE CLICKS
======================================== */

if (joinButton) {

    joinButton.addEventListener("dblclick", (event) => {

        event.preventDefault();

    });

}

});