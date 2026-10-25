
/* Replace this example with your real Render URL.
   Do not add a trailing slash. */
const API_BASE = "https://YOUR-RENDER-SERVICE.onrender.com";

const $ = (selector) => document.querySelector(selector);

let token = sessionStorage.getItem("churchAdminToken") || "";
let currentTab = "overview";
let editingId = null;
let currentItems = [];

const titles = {
  overview: "Dashboard overview",
  donations: "M-Pesa donations",
  about: "About the church",
  announcements: "Announcements",
  leaders: "Church leadership",
  services: "Church services",
  events: "Church events",
  messages: "Contact messages"
};

const schemas = {
  announcements: [
    { key: "title", label: "Title", required: true },
    { key: "body", label: "Announcement", type: "textarea", required: true },
    { key: "published", label: "Published", type: "boolean" }
  ],
  leaders: [
    { key: "name", label: "Full name", required: true },
    { key: "title", label: "Church role", required: true },
    { key: "biography", label: "Biography", type: "textarea" },
    { key: "photo_url", label: "Photo URL", type: "url" },
    { key: "display_order", label: "Display order", type: "number" },
    { key: "published", label: "Published", type: "boolean" }
  ],
  services: [
    { key: "title", label: "Service name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "day_of_week", label: "Day of week", required: true },
    { key: "start_time", label: "Start time", required: true },
    { key: "location", label: "Location" },
    { key: "display_order", label: "Display order", type: "number" },
    { key: "published", label: "Published", type: "boolean" }
  ],
  events: [
    { key: "title", label: "Event name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "event_date", label: "Date and time", type: "datetime-local", required: true },
    { key: "location", label: "Location" },
    { key: "image_url", label: "Image URL", type: "url" },
    { key: "published", label: "Published", type: "boolean" }
  ]
};

const columns = {
  donations: [
    ["created_at", "Date"],
    ["phone", "Phone"],
    ["amount", "Amount (KSh)"],
    ["status", "Status"],
    ["mpesa_receipt_number", "M-Pesa receipt"]
  ],
  messages: [
    ["created_at", "Received"],
    ["name", "Name"],
    ["email", "Email"],
    ["subject", "Subject"],
    ["message", "Message"],
    ["is_read", "Read"]
  ],
  announcements: [
    ["title", "Title"],
    ["body", "Announcement"],
    ["published", "Published"],
    ["created_at", "Created"]
  ],
  leaders: [
    ["name", "Name"],
    ["title", "Role"],
    ["biography", "Biography"],
    ["published", "Published"]
  ],
  services: [
    ["title", "Service"],
    ["day_of_week", "Day"],
    ["start_time", "Time"],
    ["location", "Location"],
    ["published", "Published"]
  ],
  events: [
    ["title", "Event"],
    ["event_date", "Date"],
    ["location", "Location"],
    ["published", "Published"]
  ]
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function message(text, type = "") {
  const element = $("#appMessage");
  element.textContent = text;
  element.className = `notice ${type}`;
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === "") return "—";

  if (key === "amount") {
    return Number(value).toLocaleString("en-KE");
  }

  if (["created_at", "updated_at", "event_date"].includes(key)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  }

  if (key === "published" || key === "is_read") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function statusBadge(value) {
  const safe = escapeHTML(value || "unknown").toLowerCase();
  return `<span class="status ${safe}">${safe}</span>`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error("Cannot reach the backend. Check the Render URL and connection.");
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    logout();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}

function showAdmin() {
  $("#loginScreen").hidden = true;
  $("#adminApp").hidden = false;
}

function logout() {
  token = "";
  sessionStorage.removeItem("churchAdminToken");
  $("#adminApp").hidden = true;
  $("#loginScreen").hidden = false;
  $("#password").value = "";
}

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const output = $("#loginMessage");
  output.textContent = "Signing in…";
  output.className = "notice";

  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("#username").value.trim(),
        password: $("#password").value
      })
    });

    token = result.token;
    sessionStorage.setItem("churchAdminToken", token);
    $("#password").value = "";
    showAdmin();
    await loadTab("overview");
  } catch (error) {
    output.textContent = error.message;
    output.className = "notice error";
  }
});

$("#logoutButton").addEventListener("click", logout);

$("#navigation").addEventListener("click", async event => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  await loadTab(button.dataset.tab);
});

async function loadTab(tab) {
  currentTab = tab;
  editingId = null;

  $("#pageTitle").textContent = titles[tab] || "Church admin";
  $("#overviewPanel").hidden = tab !== "overview";
  $("#listPanel").hidden = !["donations", "announcements", "leaders", "services", "events", "messages"].includes(tab);
  $("#aboutPanel").hidden = tab !== "about";
  $("#editorPanel").hidden = true;
  $("#addButton").hidden = !schemas[tab];

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  message("");

  try {
    if (tab === "overview") await loadOverview();
    else if (tab === "about") await loadAbout();
    else await loadList(tab);
  } catch (error) {
    message(error.message, "error");
  }
}

async function loadOverview() {
  const data = await api("/api/admin/overview");

  const stats = [
    ["Confirmed donations", `KSh ${Number(data.totalDonations).toLocaleString("en-KE")}`],
    ["Successful payments", data.completedDonations],
    ["Pending payments", data.pendingDonations],
    ["Unread messages", data.unreadMessages]
  ];

  $("#overviewPanel").innerHTML = `
    <div class="stats-grid">
      ${stats.map(([label, value]) => `
        <article class="stat-card">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </article>
      `).join("")}
    </div>
    <div class="panel">
      <h2>Recent donations</h2>
      <p class="muted">Transaction count: ${escapeHTML(data.transactionCount)}</p>
      ${renderSimpleTable(data.recentDonations || [], [
        ["created_at", "Date"],
        ["phone", "Phone"],
        ["amount", "Amount (KSh)"],
        ["status", "Status"],
        ["mpesa_receipt_number", "Receipt"]
      ])}
    </div>
  `;
}

function renderSimpleTable(items, fields) {
  if (!items.length) return '<p class="muted">No records yet.</p>';

  return `
    <div class="table-wrap"><table>
      <thead><tr>${fields.map(([, label]) => `<th>${escapeHTML(label)}</th>`).join("")}</tr></thead>
      <tbody>${items.map(item => `
        <tr>${fields.map(([key]) => {
          const value = formatValue(key, item[key]);
          return `<td>${key === "status" ? statusBadge(value) : escapeHTML(value)}</td>`;
        }).join("")}</tr>
      `).join("")}</tbody>
    </table></div>
  `;
}

async function loadList(tab) {
  const result = await api(`/api/admin/${tab}`);
  currentItems = result.items || [];

  $("#listTitle").textContent = titles[tab];
  $("#tableContainer").innerHTML = renderListTable(tab, currentItems);
}

function renderListTable(tab, items) {
  if (!items.length) {
    return '<p class="muted">No records yet. Use the Add new button to create one.</p>';
  }

  const fields = columns[tab] || [];

  return `
    <div class="table-wrap"><table>
      <thead><tr>
        ${fields.map(([, label]) => `<th>${escapeHTML(label)}</th>`).join("")}
        <th>Actions</th>
      </tr></thead>
      <tbody>${items.map(item => `
        <tr>
          ${fields.map(([key]) => {
            const value = formatValue(key, item[key]);
            return `<td>${key === "status" ? statusBadge(value) : escapeHTML(value)}</td>`;
          }).join("")}
          <td><div class="actions">
            ${schemas[tab] ? `<button class="small-button" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>` : ""}
            ${tab === "messages" ? `
              <button class="small-button" data-action="read" data-id="${escapeHTML(item.id)}">
                ${item.is_read ? "Mark unread" : "Mark read"}
              </button>` : ""}
            ${tab !== "donations" ? `
              <button class="small-button danger" data-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>` : ""}
          </div></td>
        </tr>
      `).join("")}</tbody>
    </table></div>
  `;
}

$("#tableContainer").addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const item = currentItems.find(row => String(row.id) === String(id));

  try {
    if (action === "edit" && item) {
      openEditor(item);
      return;
    }

    if (action === "read" && item) {
      await api(`/api/admin/messages/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: !item.is_read })
      });
      message("Message status updated.", "success");
      await loadTab(currentTab);
      return;
    }

    if (action === "delete") {
      if (!confirm("Delete this record permanently? This cannot be undone.")) return;

      await api(`/api/admin/${currentTab}/${id}`, { method: "DELETE" });
      message("Record deleted.", "success");
      await loadTab(currentTab);
    }
  } catch (error) {
    message(error.message, "error");
  }
});

$("#addButton").addEventListener("click", () => openEditor(null));
$("#cancelEdit").addEventListener("click", () => {
  $("#editorPanel").hidden = true;
});

function openEditor(item) {
  editingId = item ? item.id : null;
  $("#editorTitle").textContent = item ? "Edit record" : "Add new record";

  $("#dynamicFields").innerHTML = schemas[currentTab].map(field => {
    let value = item?.[field.key] ?? "";
    const required = field.required ? "required" : "";
    const full = field.type === "textarea" ? "field-full" : "";

    if (field.type === "datetime-local" && value) {
      const date = new Date(value);
      value = Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
    }

    if (field.type === "boolean") {
      return `
        <div class="${full}">
          <label for="field-${field.key}">${escapeHTML(field.label)}</label>
          <select id="field-${field.key}" name="${field.key}">
            <option value="true" ${value === true ? "selected" : ""}>Yes — published</option>
            <option value="false" ${value !== true ? "selected" : ""}>No — draft</option>
          </select>
        </div>`;
    }

    if (field.type === "textarea") {
      return `
        <div class="${full}">
          <label for="field-${field.key}">${escapeHTML(field.label)}</label>
          <textarea id="field-${field.key}" name="${field.key}" ${required}>${escapeHTML(value)}</textarea>
        </div>`;
    }

    return `
      <div class="${full}">
        <label for="field-${field.key}">${escapeHTML(field.label)}</label>
        <input id="field-${field.key}" name="${field.key}"
          type="${field.type || "text"}"
          value="${escapeHTML(value)}" ${required}>
      </div>`;
  }).join("");

  $("#editorPanel").hidden = false;
  $("#editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#recordForm").addEventListener("submit", async event => {
  event.preventDefault();

  const payload = {};
  const formData = new FormData(event.currentTarget);

  for (const field of schemas[currentTab]) {
    let value = formData.get(field.key);

    if (field.type === "boolean") value = value === "true";
    if (field.type === "number") value = Number(value || 0);
    if (field.type === "datetime-local" && value) {
      value = new Date(value).toISOString();
    }

    payload[field.key] = value;
  }

  try {
    if (editingId) {
      await api(`/api/admin/${currentTab}/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      message("Record updated successfully.", "success");
    } else {
      await api(`/api/admin/${currentTab}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      message("Record created successfully.", "success");
    }

    $("#editorPanel").hidden = true;
    await loadTab(currentTab);
  } catch (error) {
    message(error.message, "error");
  }
});

async function loadAbout() {
  const result = await api("/api/admin/about");
  $("#aboutTitle").value = result.content.title || "";
  $("#aboutBody").value = result.content.body || "";
}

$("#aboutForm").addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await api("/api/admin/about", {
      method: "PUT",
      body: JSON.stringify({
        title: $("#aboutTitle").value,
        body: $("#aboutBody").value
      })
    });

    message("About page content saved.", "success");
  } catch (error) {
    message(error.message, "error");
  }
});

/* Restore a login session in this browser tab if one exists. */
if (token) {
  showAdmin();
  loadTab("overview").catch(error => {
    message(error.message, "error");
  });
}
