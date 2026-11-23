(() => {
  "use strict";

  const root = document.querySelector("#visitBooking");
  if (!root) return;

  const timezone = window.CHURCH_CONFIG?.timezone || "Africa/Nairobi";
  const dateFormatter = new Intl.DateTimeFormat("en-KE", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const monthFormatter = new Intl.DateTimeFormat("en-KE", {
    timeZone: timezone,
    month: "long",
    year: "numeric"
  });
  const clockFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const timeFormatter = new Intl.DateTimeFormat("en-KE", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  const $ = (selector) => root.querySelector(selector);
  const calendarBody = $("#bookingCalendarDays");
  const monthHeading = $("#bookingMonth");
  const prevButton = $("#bookingPrevMonth");
  const nextButton = $("#bookingNextMonth");
  const todayButton = $("#bookingToday");
  const clearButton = $("#bookingClear");
  const slotHeading = $("#bookingSlotHeading");
  const slotHint = $("#bookingSlotHint");
  const slotContainer = $("#bookingTimeSlots");
  const summaryDate = $("#bookingSummaryDate");
  const summaryTime = $("#bookingSummaryTime");
  const requestForm = $("#bookingRequestForm");
  const submitButton = $("#bookingSubmit");
  const submitLabel = $("#bookingSubmitLabel");
  const status = $("#bookingStatus");
  if (!calendarBody || !monthHeading || !requestForm) return;

  const todayInNairobi = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const toDate = (dateString) => new Date(`${dateString}T12:00:00Z`);
  const pad = (value) => String(value).padStart(2, "0");
  const dateString = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
  const monthKey = (year, month) => year * 12 + month;
  const monthFromKey = (key) => ({ year: Math.floor(key / 12), month: ((key % 12) + 12) % 12 });
  const timeParts = () => {
    const parts = Object.fromEntries(clockFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
    return Number(parts.hour) * 60 + Number(parts.minute);
  };
  const formattedDate = (date) => dateFormatter.format(toDate(date));
  const formattedTime = (date, time) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    // Nairobi uses EAT (UTC+03:00); format explicitly in the configured timezone.
    const instant = new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
    return timeFormatter.format(instant);
  };
  const currentDate = todayInNairobi();
  const [initialYear, initialMonth] = currentDate.split("-").map(Number);
  const state = {
    year: initialYear,
    month: initialMonth - 1,
    selectedDate: "",
    selectedTime: "",
    submitting: false
  };

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const setStatus = (message, kind = "") => {
    status.textContent = message;
    status.classList.toggle("is-success", kind === "success");
    status.classList.toggle("is-error", kind === "error");
  };

  const officeHoursFor = (date) => {
    const weekday = toDate(date).getUTCDay();
    if (weekday >= 1 && weekday <= 5) return { open: 9 * 60, close: 17 * 60, label: "Monday–Friday, 9:00 AM–5:00 PM" };
    if (weekday === 6) return { open: 10 * 60, close: 14 * 60, label: "Saturday, 10:00 AM–2:00 PM" };
    return null;
  };

  const updateSummary = () => {
    if (state.selectedDate) {
      summaryDate.textContent = formattedDate(state.selectedDate);
      summaryDate.classList.remove("is-empty");
    } else {
      summaryDate.textContent = "Choose a date";
      summaryDate.classList.add("is-empty");
    }
    if (state.selectedDate && state.selectedTime) {
      summaryTime.textContent = `${formattedTime(state.selectedDate, state.selectedTime)} EAT`;
      summaryTime.classList.remove("is-empty");
    } else {
      summaryTime.textContent = "Choose a preferred time";
      summaryTime.classList.add("is-empty");
    }
  };

  const renderCalendar = () => {
    const monthDate = new Date(Date.UTC(state.year, state.month, 1, 12));
    monthHeading.textContent = monthFormatter.format(monthDate);
    const thisMonthKey = monthKey(state.year, state.month);
    const todayMonth = todayInNairobi().slice(0, 7).split("-").map(Number);
    prevButton.disabled = thisMonthKey <= monthKey(todayMonth[0], todayMonth[1] - 1);
    const firstWeekdayMonday = (monthDate.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(state.year, state.month + 1, 0)).getUTCDate();
    const today = todayInNairobi();
    const firstFocusable = state.selectedDate.startsWith(`${state.year}-${pad(state.month + 1)}`)
      ? state.selectedDate
      : (today.startsWith(`${state.year}-${pad(state.month + 1)}`) ? today : "");
    const tbody = document.createDocumentFragment();
    let tabStopPlaced = false;

    for (let week = 0; week < 6; week += 1) {
      const row = document.createElement("tr");
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const cell = document.createElement("td");
        const day = week * 7 + weekday - firstWeekdayMonday + 1;
        if (day < 1 || day > daysInMonth) {
          cell.className = "is-outside";
          cell.setAttribute("aria-hidden", "true");
          cell.append(makeElement("span", "booking-calendar-empty"));
        } else {
          const date = dateString(state.year, state.month, day);
          const button = makeElement("button", "booking-day", String(day));
          button.type = "button";
          button.dataset.bookingDate = date;
          button.setAttribute("role", "gridcell");
          button.setAttribute("aria-pressed", String(date === state.selectedDate));
          const isPast = date < today;
          const isToday = date === today;
          if (isPast) button.disabled = true;
          if (isToday) {
            button.classList.add("is-today");
            button.setAttribute("aria-current", "date");
          }
          if (date === state.selectedDate) button.classList.add("is-selected");
          const spokenDate = formattedDate(date);
          button.setAttribute("aria-label", `${spokenDate}${isToday ? ", today" : ""}${isPast ? ", unavailable, past date" : ""}`);
          if (!isPast && (date === firstFocusable || (!firstFocusable && !tabStopPlaced))) {
            button.tabIndex = 0;
            tabStopPlaced = true;
          } else button.tabIndex = -1;
          cell.append(button);
        }
        row.append(cell);
      }
      tbody.append(row);
    }
    calendarBody.replaceChildren(tbody);
    calendarBody.classList.remove("booking-calendar-body");
    // Restart the month transition without relying on an external animation library.
    void calendarBody.offsetWidth;
    calendarBody.classList.add("booking-calendar-body");
  };

  const renderTimeSlots = () => {
    slotContainer.replaceChildren();
    updateSummary();
    if (!state.selectedDate) {
      slotHeading.textContent = "Choose a date first";
      slotHint.textContent = "Select any date from today onward to see the church’s request times.";
      return;
    }

    const officeHours = officeHoursFor(state.selectedDate);
    slotHeading.textContent = "Choose a preferred time";
    if (!officeHours) {
      slotHint.textContent = "The church office is closed on Sundays. Please choose another day, or call the church about arranging a meeting around worship.";
      slotContainer.append(makeElement("p", "booking-slots-empty", "No office appointment requests are listed for Sunday."));
      return;
    }

    const today = todayInNairobi();
    const nowMinutes = timeParts();
    slotHint.textContent = `${officeHours.label} · Kenya time. These are preferred request times, subject to confirmation.`;
    let futureCount = 0;
    for (let start = officeHours.open; start + 30 <= officeHours.close; start += 30) {
      const hour = Math.floor(start / 60);
      const minute = start % 60;
      const value = `${pad(hour)}:${pad(minute)}`;
      const unavailable = state.selectedDate < today || (state.selectedDate === today && start <= nowMinutes);
      if (!unavailable) futureCount += 1;
      const button = makeElement("button", `booking-slot ${unavailable ? "is-unavailable" : "is-requestable"}${value === state.selectedTime ? " is-selected" : ""}`);
      button.type = "button";
      button.dataset.bookingTime = value;
      button.disabled = unavailable;
      button.setAttribute("aria-pressed", String(value === state.selectedTime));
      const label = formattedTime(state.selectedDate, value);
      button.setAttribute("aria-label", unavailable ? `${label}, unavailable because this time has passed` : `Request ${label} East Africa Time`);
      button.append(makeElement("span", "", label), makeElement("small", "", unavailable ? "Passed" : (value === state.selectedTime ? "Selected" : "Request")));
      slotContainer.append(button);
    }

    if (!futureCount) {
      slotHint.textContent = `No future request times remain today. ${officeHours.label} · Kenya time. Choose another date to request a visit.`;
    }
  };

  const selectDate = (date, focus = false) => {
    if (date < todayInNairobi()) return;
    state.selectedDate = date;
    state.selectedTime = "";
    const [year, month] = date.split("-").map(Number);
    state.year = year;
    state.month = month - 1;
    renderCalendar();
    renderTimeSlots();
    setStatus("");
    if (focus) calendarBody.querySelector(`[data-booking-date="${date}"]`)?.focus();
  };

  calendarBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-booking-date]");
    if (button && !button.disabled) selectDate(button.dataset.bookingDate);
  });

  calendarBody.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-booking-date]");
    if (!button) return;
    const date = toDate(button.dataset.bookingDate);
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const direction = event.key === "PageUp" ? -1 : 1;
      const monthDelta = direction * (event.shiftKey ? 12 : 1);
      const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthDelta, 1));
      const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
      const target = dateString(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(date.getUTCDate(), lastDay));
      if (target >= todayInNairobi()) selectDate(target, true);
      else calendarBody.querySelector(".booking-day:not(:disabled)")?.focus();
      return;
    }
    let delta = 0;
    if (event.key === "ArrowLeft") delta = -1;
    else if (event.key === "ArrowRight") delta = 1;
    else if (event.key === "ArrowUp") delta = -7;
    else if (event.key === "ArrowDown") delta = 7;
    else if (event.key === "Home") delta = -((date.getUTCDay() + 6) % 7);
    else if (event.key === "End") delta = 6 - ((date.getUTCDay() + 6) % 7);
    else return;
    event.preventDefault();
    const moved = new Date(date.getTime() + delta * 86400000);
    const target = `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
    if (target >= todayInNairobi()) selectDate(target, true);
    else {
      const firstAvailable = calendarBody.querySelector(".booking-day:not(:disabled)");
      firstAvailable?.focus();
    }
  });

  slotContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-booking-time]");
    if (!button || button.disabled) return;
    state.selectedTime = button.dataset.bookingTime;
    slotContainer.querySelectorAll("[data-booking-time]").forEach((slot) => {
      const selected = slot.dataset.bookingTime === state.selectedTime;
      slot.classList.toggle("is-selected", selected);
      slot.setAttribute("aria-pressed", String(selected));
      const small = slot.querySelector("small");
      if (small && !slot.disabled) small.textContent = selected ? "Selected" : "Request";
    });
    updateSummary();
    setStatus("");
  });

  prevButton.addEventListener("click", () => {
    const month = monthFromKey(monthKey(state.year, state.month) - 1);
    state.year = month.year;
    state.month = month.month;
    renderCalendar();
  });
  nextButton.addEventListener("click", () => {
    const month = monthFromKey(monthKey(state.year, state.month) + 1);
    state.year = month.year;
    state.month = month.month;
    renderCalendar();
  });
  todayButton.addEventListener("click", () => selectDate(todayInNairobi(), true));
  clearButton.addEventListener("click", () => {
    state.selectedDate = "";
    state.selectedTime = "";
    renderCalendar();
    renderTimeSlots();
    setStatus("Your date and time selection has been cleared.");
  });

  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.submitting) return;
    if (!requestForm.reportValidity()) return;
    if (!state.selectedDate) {
      setStatus("Please choose a date on the calendar before sending your request.", "error");
      calendarBody.querySelector(".booking-day:not(:disabled)")?.focus();
      return;
    }
    if (!state.selectedTime) {
      setStatus("Please choose a preferred time, or select another date if no future times remain.", "error");
      slotHeading.focus();
      return;
    }
    const [selectedHour, selectedMinute] = state.selectedTime.split(":").map(Number);
    if (state.selectedDate < todayInNairobi() || (state.selectedDate === todayInNairobi() && selectedHour * 60 + selectedMinute <= timeParts())) {
      state.selectedTime = "";
      renderTimeSlots();
      setStatus("That time has passed in Nairobi. Please choose a future time.", "error");
      return;
    }

    state.submitting = true;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitLabel.textContent = "Sending request…";
    setStatus("Sending your preferred visit time securely…");
    const name = $("#bookingName").value.trim();
    const email = $("#bookingEmail").value.trim();
    const purpose = $("#bookingPurpose").value;
    const note = $("#bookingNote").value.trim();
    const dateLabel = formattedDate(state.selectedDate);
    const timeLabel = `${formattedTime(state.selectedDate, state.selectedTime)} EAT (Africa/Nairobi)`;
    const message = [
      `Preferred meeting type: ${purpose}.`,
      `Preferred date: ${dateLabel}.`,
      `Preferred time: ${timeLabel}.`,
      note ? `Additional note: ${note}` : "No additional note was provided.",
      "Please contact me to confirm whether this requested time is available. I understand this request is not a confirmed reservation."
    ].join("\n");

    try {
      const response = await fetch("https://imperishable-church-mpesa-backend-fa2a.onrender.com/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject: "Visit time request", message }),
        signal: AbortSignal.timeout(15000)
      });
      let result = {};
      try { result = await response.json(); } catch {}
      if (!response.ok) throw new Error(result.error || result.message || "We could not send your request. Please call the church instead.");
      requestForm.reset();
      state.selectedDate = "";
      state.selectedTime = "";
      renderCalendar();
      renderTimeSlots();
      setStatus(`Thank you, ${name}. Your preferred time request has been sent. The church will contact you to confirm; this is not yet a confirmed appointment.`, "success");
    } catch (error) {
      setStatus(error.message || "A connection issue prevented sending. Please try again or call the church.", "error");
    } finally {
      state.submitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitLabel.textContent = "Request this time";
    }
  });

  slotHeading.tabIndex = -1;
  renderCalendar();
  renderTimeSlots();
})();
