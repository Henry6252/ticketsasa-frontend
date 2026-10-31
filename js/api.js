/* ==========================================================================
   api.js - connects the Ticketsasa frontend to the Django backend.

   Load it AFTER app.js (see index.html). It leaves app.js untouched and simply
   redefines the few functions that used mock data, so every onclick="..." in
   the HTML keeps working.
   ========================================================================== */

// Change this to your deployed API URL in production, e.g. "https://api.yourdomain.com/api"
const API_BASE = "https://ticketsasa-backend-1.onrender.com/api";

// Drop the demo data from app.js - the real data now comes from the server.
events = [];
ticketDatabase = [];

/* ---------------------------------------------------------------- helpers */
const Auth = {
    get token() { return sessionStorage.getItem("ts_token"); },
    save(token) { sessionStorage.setItem("ts_token", token); },
    clear() { sessionStorage.removeItem("ts_token"); }
};

function esc(value) {
    const d = document.createElement("div");
    d.textContent = value == null ? "" : String(value);
    return d.innerHTML;
}

function extractError(data) {
    if (!data) return null;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    // DRF field errors: { phone: ["..."], email: ["..."] }
    return Object.entries(data)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(" ") : msgs}`)
        .join("\n");
}

async function apiFetch(path, { method = "GET", body, auth = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth && Auth.token) headers["Authorization"] = `Token ${Auth.token}`;

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (networkErr) {
        throw new Error("Cannot reach the server. Is the Django backend running?");
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }

    if (!res.ok) {
        const err = new Error(extractError(data) || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return data;
}

/* ----------------------------------------------------------------- events */
function mapEvent(e) {
    return {
        id: e.id,
        title: e.title,
        category: e.category,
        venue: e.venue,
        date: e.date,
        displayDate: e.display_date,
        image: e.image,
        featured: e.is_featured,
        description: e.description,
        tiers: e.tiers.map(t => ({ id: t.id, name: t.name, price: Number(t.price), available: t.available }))
    };
}

async function loadEventsFromApi() {
    const grid = document.getElementById("eventsGrid");
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-400">Loading events...</div>`;
    try {
        const data = await apiFetch("/events/");
        events = data.map(mapEvent);
        renderEventsGrid(events);
        const featuredIdx = events.findIndex(e => e.featured);
        heroIndex = featuredIdx >= 0 ? featuredIdx : 0;
        updateHero();
    } catch (err) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-red-500">${esc(err.message)}</div>`;
    }
}

// Hero banner now follows real events (title, image, date, venue, price, button).
function updateHero() {
    if (!events.length) return;
    const ev = events[((heroIndex % events.length) + events.length) % events.length];
    const minPrice = Math.min(...ev.tiers.map(t => t.price));

    document.getElementById("heroImage").src = ev.image;
    document.getElementById("heroTitle").innerText = ev.title;
    document.getElementById("heroSubtitle").innerText =
        ev.description || `Book official tickets for ${ev.title} live at ${ev.venue}. Secure payment via M-Pesa.`;

    const spans = document.getElementById("heroTitle").parentElement.querySelectorAll(".flex-wrap > span");
    if (spans.length === 3) {
        spans[0].innerHTML = `<i class="fa-regular fa-calendar-check text-sasaRed"></i> ${esc(ev.displayDate)}`;
        spans[1].innerHTML = `<i class="fa-solid fa-location-dot text-sasaRed"></i> ${esc(ev.venue)}`;
        spans[2].innerHTML = `<i class="fa-solid fa-tag text-sasaRed"></i> KES ${minPrice.toLocaleString()}`;
    }
    const btn = document.getElementById("heroTitle").parentElement.querySelector("button[onclick^='openBookingModal']");
    if (btn) btn.setAttribute("onclick", `openBookingModal(${ev.id})`);
}

window.addEventListener("DOMContentLoaded", loadEventsFromApi);

/* -------------------------------------------------------- buying (Pesapal) */
function mapTicket(t) {
    return {
        uuid: t.code,
        eventTitle: t.event_title,
        eventDate: t.event_date_display,
        venue: t.venue,
        tier: t.tier_name,
        customerName: t.customer_name,
        mpesaRef: t.payment_reference || "Confirming..."   // shown as "Payment Ref" on the pass
    };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Asks the server every 3s whether the payment is confirmed (max ~2 minutes).
// Checks payment status every 3 seconds (maximum 2 minutes).
async function pollOrder(orderId, attempts = 40) {
    const token = sessionStorage.getItem(`ts_order_token_${orderId}`);

    if (!token) {
        throw new Error(
            "Your secure order token is missing. Please contact support with your order reference."
        );
    }

    for (let i = 0; i < attempts; i++) {
        const order = await apiFetch(
            `/orders/${orderId}/?token=${encodeURIComponent(token)}`
        );

        if (order.status !== "PENDING") {
            return order;
        }

        await sleep(3000);
    }

    return { status: "PENDING" };
}

// Step 1: create the order, then send the customer to Pesapal's secure payment page.
// (Function name kept so the form's onsubmit="processMpesaPayment(event)" keeps working.)
async function processMpesaPayment(e) {
    e.preventDefault();
    const btn = document.getElementById("payButton");
    const resetBtn = () => {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay securely with Pesapal`;
    };

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Creating your order...`;

    try {
       const order = await apiFetch("/orders/", {
    method: "POST",
    body: {
        tier_id: selectedTierObj.id,
        quantity: currentQty,
        name: document.getElementById("custName").value.trim(),
        phone: document.getElementById("custPhone").value.trim(),
        email: document.getElementById("custEmail").value.trim()
    }
});

sessionStorage.setItem(
    `ts_order_token_${order.order_id}`,
    order.download_token
);
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Redirecting to Pesapal...`;
        window.location.href = order.redirect_url;   // leaves the site; Pesapal sends the customer back
    } catch (err) {
        alert(err.message);
        resetBtn();
    }
}

// If the customer presses "Back" from Pesapal the page can come back with a stuck button.
window.addEventListener("pageshow", ev => { if (ev.persisted) window.location.reload(); });

// Step 2: Pesapal -> Django callback -> back here as  /?order=<id>.  Confirm and show the ticket.
function showBanner(text) {
    const el = document.createElement("div");
    el.className = "fixed top-0 inset-x-0 z-[70] bg-sasaDark text-white text-center text-xs font-semibold py-3";
    el.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-2"></i>${esc(text)}`;
    document.body.appendChild(el);
    return el;
}

async function handlePesapalReturn() {
    const orderId = new URLSearchParams(window.location.search).get("order");
    if (!orderId) return;

    const banner = showBanner("Confirming your payment with Pesapal...");
    try {
        const result = await pollOrder(orderId);
        banner.remove();
        history.replaceState({}, "", window.location.pathname);   // clean the URL

        if (result.status === "PAID") {

    const token = sessionStorage.getItem(`ts_order_token_${orderId}`);

    if (!token) {
        throw new Error("Your secure download token is missing. Please contact support with your order reference.");
    }

    // Connect the PDF button to the secure Django download endpoint.
    const downloadButton = document.getElementById("ticketDownloadButton");

    downloadButton.href =
        `${API_BASE}/orders/${orderId}/tickets/${encodeURIComponent(token)}/`;

    downloadButton.classList.remove("hidden");

    const tickets = result.tickets.map(mapTicket);

    // Display the first ticket while the PDF contains all tickets.
    showTicketPass(tickets[0]);
            if (tickets.length > 1) {
                alert(`${tickets.length} tickets have been issued successfully. You can download them directly from this page.`);
            }
            loadEventsFromApi();   // refresh remaining stock
        } else if (result.status === "FAILED") {
            alert("The payment didn't go through or was cancelled. No tickets were issued - please try again.");
        } else if (result.status === "REVIEW") {
            alert("Your payment needs a quick manual check. Please contact support with your payment confirmation.");
        } else {
            alert("Payment confirmation is still pending. No tickets have been issued yet. Please check again shortly.");
        }
    } catch (err) {
        banner.remove();
        alert(err.message);
    }
}

window.addEventListener("DOMContentLoaded", handlePesapalReturn);

/* ------------------------------------------------------ staff login (token) */
function showLoginModal() {
    return new Promise(resolve => {
        const wrap = document.createElement("div");
        wrap.className = "fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4";
        wrap.innerHTML = `
            <form class="bg-white rounded-2xl max-w-sm w-full p-6 space-y-3 shadow-2xl text-xs">
                <div class="flex justify-between items-center">
                    <h3 class="font-extrabold text-sasaDark text-base">Staff sign in</h3>
                    <button type="button" data-cancel class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <p class="text-gray-500">Organizer dashboard and gate scanner are for staff only.</p>
                <input name="username" required placeholder="Username" autocomplete="username" class="w-full border rounded-lg px-3 py-2">
                <input name="password" type="password" required placeholder="Password" autocomplete="current-password" class="w-full border rounded-lg px-3 py-2">
                <p data-error class="text-red-600 font-semibold hidden"></p>
                <button type="submit" class="w-full bg-sasaRed text-white py-2.5 rounded-xl font-bold hover:bg-sasaRedHover transition">Sign in</button>
            </form>`;
        document.body.appendChild(wrap);

        const form = wrap.querySelector("form");
        const errorBox = wrap.querySelector("[data-error]");
        const close = ok => { wrap.remove(); resolve(ok); };

        wrap.querySelector("[data-cancel]").onclick = () => close(false);
        form.onsubmit = async ev => {
            ev.preventDefault();
            errorBox.classList.add("hidden");
            try {
                const res = await apiFetch("/auth/login/", {
                    method: "POST",
                    body: { username: form.username.value, password: form.password.value }
                });
                Auth.save(res.token);
                close(true);
            } catch (err) {
                errorBox.textContent = err.message;
                errorBox.classList.remove("hidden");
            }
        };
    });
}

function logoutStaff() {
    Auth.clear();
    switchView("storefront");
}

// Gate the two staff-only views behind login.
const _originalSwitchView = switchView;
switchView = async function (viewName) {
    if ((viewName === "dashboard" || viewName === "scanner") && !Auth.token) {
        const ok = await showLoginModal();
        if (!ok) { _originalSwitchView("storefront"); return; }
    }
    _originalSwitchView(viewName);
};

/* -------------------------------------------------------- organizer dashboard */
async function loadDashboardStats() {
    if (!Auth.token) return;
    try {
        const s = await apiFetch("/admin/stats/", { auth: true });

        document.getElementById("dashGrossRevenue").innerText = `KES ${Number(s.gross_revenue).toLocaleString()}`;
        document.getElementById("dashTicketsSold").innerText = String(s.tickets_sold);
        document.getElementById("dashGateCheckins").innerText = String(s.checked_in);
        const activeEvents = document.querySelector("#view-dashboard h3:not([id])");
        if (activeEvents) activeEvents.innerText = String(s.active_events);

        if (revenueChartInstance) {
            revenueChartInstance.data.labels = s.revenue_by_day.map(d => d.label);
            revenueChartInstance.data.datasets[0].data = s.revenue_by_day.map(d => d.total);
            revenueChartInstance.update();
        }
        if (tierChartInstance && s.tier_distribution.length) {
            tierChartInstance.data.labels = s.tier_distribution.map(t => t.label);
            tierChartInstance.data.datasets[0].data = s.tier_distribution.map(t => t.count);
            tierChartInstance.data.datasets[0].backgroundColor =
                ["#1A1A1A", "#D9232D", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"].slice(0, s.tier_distribution.length);
            tierChartInstance.update();
        }

        const tbody = document.getElementById("dashboardTransactionsTable");
        tbody.innerHTML = s.recent_tickets.map(t => `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 font-mono font-bold text-sasaDark">${esc(t.code)}</td>
                <td class="p-4 font-semibold">${esc(t.customer_name)}</td>
                <td class="p-4">${esc(t.event_title)}</td>
                <td class="p-4 font-bold text-sasaRed">${esc(t.tier_name)}</td>
                <td class="p-4 font-mono text-emerald-600">${esc(t.payment_reference || "-")}</td>
                <td class="p-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${t.is_checked_in ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}">
                        ${t.is_checked_in ? "Checked-In" : "Valid Pass"}
                    </span>
                </td>
                <td class="p-4 text-gray-400">${esc(t.checked_in_display || "Pending Entry")}</td>
            </tr>`).join("");
    } catch (err) {
        if (err.status === 401 || err.status === 403) { Auth.clear(); }
        console.error("Dashboard:", err.message);
    }
}

// app.js calls these after sales / scans; the real work happens in one request.
function updateDashboardMetrics() { loadDashboardStats(); }
function renderDashboardTable() { /* handled by loadDashboardStats() */ }

/* ------------------------------------------------------------ gate scanner */
async function verifyTicketCode(code) {
    const box = document.getElementById("scanResultBox");
    box.classList.remove(
        "hidden",
        "bg-emerald-50", "border-emerald-200", "text-emerald-800",
        "bg-red-50", "border-red-200", "text-red-800",
        "bg-amber-50", "border-amber-200", "text-amber-900"
    );

    try {
        const r = await apiFetch("/gate/verify/", { method: "POST", auth: true, body: { code } });

        if (r.result === "invalid") {
            box.classList.add("bg-red-50", "border-red-200", "text-red-800");
            box.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-sm">
                    <i class="fa-solid fa-circle-xmark text-red-600 text-base"></i> INVALID TICKET TOKEN
                </div>
                <p>No ticket record matching <b>${esc(code)}</b> was found.</p>`;
            addGateLog(code, "FAILED: Invalid Code", "red");
            return;
        }

        const t = r.ticket;
        if (r.result === "duplicate") {
            box.classList.add("bg-amber-50", "border-amber-200", "text-amber-900");
            box.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-sm">
                    <i class="fa-solid fa-triangle-exclamation text-amber-600 text-base"></i> WARNING: ALREADY CHECKED IN
                </div>
                <p>Ticket <b>${esc(t.code)}</b> (${esc(t.customer_name)}) was already verified at <b>${esc(t.checked_in_display)}</b>. Entry Denied.</p>`;
            addGateLog(t.code, `DUPLICATE ENTRY (${t.customer_name})`, "amber");
            return;
        }

        box.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-800");
        box.innerHTML = `
            <div class="flex items-center gap-2 font-bold text-sm">
                <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i> ENTRY AUTHORIZED
            </div>
            <div class="mt-1 space-y-0.5">
                <p><b>Attendee:</b> ${esc(t.customer_name)}</p>
                <p><b>Event:</b> ${esc(t.event_title)}</p>
                <p><b>Tier:</b> ${esc(t.tier_name)}</p>
            </div>`;
        addGateLog(t.code, `AUTHORIZED - ${t.customer_name}`, "emerald");
        loadDashboardStats();
    } catch (err) {
        if (err.status === 401 || err.status === 403) Auth.clear();
        box.classList.add("bg-red-50", "border-red-200", "text-red-800");
        box.innerHTML = `<div class="font-bold text-sm">${esc(err.message)}</div>`;
    }
}

/* ------------------------------------------------------- create new event */
async function handleCreateEvent(e) {
    e.preventDefault();
    const form = e.target;
    try {
        await apiFetch("/admin/events/", {
            method: "POST",
            auth: true,
            body: {
                title: document.getElementById("newEventTitle").value.trim(),
                category: document.getElementById("newEventCat").value,
                venue: document.getElementById("newEventVenue").value.trim(),
                event_date: `${document.getElementById("newEventDate").value}T18:00:00`, // 6pm; edit exact time in /admin/
                price: document.getElementById("newEventPrice").value,
                image_url: document.getElementById("newEventImg").value.trim()
            }
        });
        toggleModal("createEventModal");
        form.reset();
        await loadEventsFromApi();
        loadDashboardStats();
        alert("New event published successfully to public storefront!");
    } catch (err) {
        if (err.status === 401 || err.status === 403) { Auth.clear(); }
        alert(err.message);
    }
}

function exportReport() {
    alert("Open the Django admin (/admin/) > Tickets, select rows and choose 'Export selected tickets to CSV'.");
}