/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   WELCOME PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {

    const joinButton = document.getElementById("joinButton");

    // Check that the welcome button exists.
    if (!joinButton) {
        return;
    }

    // Add a small visual response when clicked.
    joinButton.addEventListener("click", () => {
        joinButton.classList.add("clicked");
    });

});