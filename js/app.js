// --- DATA STATE ---
let events = [
    {
        id: 1,
        title: "Sol Fest Africa 2026",
        category: "Music",
        venue: "Uhuru Gardens, Nairobi",
        date: "2026-12-18",
        displayDate: "Sat, 18 Dec 2026",
        image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
        tiers: [
            { name: "Regular Advance", price: 3500 },
            { name: "VIP Lounge", price: 8000 },
            { name: "VVIP All-Access", price: 15000 }
        ]
    },
    {
        id: 2,
        title: "Blankets & Wine Edition",
        category: "Music",
        venue: "Laurette Park, Karen",
        date: "2026-11-05",
        displayDate: "Sun, 05 Nov 2026",
        image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80",
        tiers: [
            { name: "Early Bird", price: 2500 },
            { name: "Regular Entry", price: 3500 }
        ]
    },
    {
        id: 3,
        title: "Nairobi Comedy Night Live",
        category: "Theatre",
        venue: "KICC Auditorium, Nairobi",
        date: "2026-10-30",
        displayDate: "Fri, 30 Oct 2026",
        image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=600&q=80",
        tiers: [
            { name: "Standard Seat", price: 1500 },
            { name: "Front Row VIP", price: 3000 }
        ]
    },
    {
        id: 4,
        title: "Kilifi New Year Festival 2026",
        category: "Nightlife",
        venue: "Beneath the Baobabs, Kilifi",
        date: "2026-12-30",
        displayDate: "30 Dec - 02 Jan 2027",
        image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80",
        tiers: [
            { name: "3-Day Pass", price: 7500 },
            { name: "VIP Backstage", price: 14000 }
        ]
    }
];

// System Tickets Storage DB
let ticketDatabase = [
    {
        uuid: "TICKET-9821-4402",
        eventId: 1,
        eventTitle: "Sol Fest Africa 2026",
        venue: "Uhuru Gardens, Nairobi",
        eventDate: "Sat, 18 Dec 2026",
        tier: "VIP Lounge",
        price: 8000,
        customerName: "Amina Mohamed",
        phone: "0712345678",
        email: "amina@example.com",
        mpesaRef: "QK89201920",
        isCheckedIn: false,
        checkInTime: null
    }
];

let selectedEvent = null;
let selectedTierObj = null;
let currentQty = 1;
let heroIndex = 0;
let revenueChartInstance = null;
let tierChartInstance = null;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    renderEventsGrid(events);
    updateDashboardMetrics();
    initDashboardCharts();
    renderDashboardTable();
});

// --- VIEW SWITCHING ---
function switchView(viewName) {
    document.getElementById('viewSelector').value = viewName;
    ['storefront', 'dashboard', 'scanner', 'architecture'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
    });
    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) activeView.classList.remove('hidden');

    if (viewName === 'dashboard') {
        updateDashboardMetrics();
    }
}

// --- HERO CAROUSEL ---
function updateHero() {
    const ev = events[heroIndex % events.length];
    document.getElementById('heroImage').src = ev.image;
    document.getElementById('heroTitle').innerText = ev.title;
    document.getElementById('heroSubtitle').innerText = `Book official tickets for ${ev.title} live at ${ev.venue}. Secure payment via M-Pesa.`;
}
function nextHero() { heroIndex++; updateHero(); }
function prevHero() { heroIndex = (heroIndex - 1 + events.length) % events.length; updateHero(); }

// --- STOREFRONT RENDER ---
function renderEventsGrid(items) {
    const grid = document.getElementById('eventsGrid');
    document.getElementById('eventCount').innerText = `Showing ${items.length} Events`;
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-400">No events matched your filter criteria.</div>`;
        return;
    }

    items.forEach(ev => {
        const minPrice = Math.min(...ev.tiers.map(t => t.price));
        grid.innerHTML += `
            <div class="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition duration-300 flex flex-col">
                <div class="relative h-48 overflow-hidden">
                    <img src="${ev.image}" alt="${ev.title}" class="w-full h-full object-cover hover:scale-105 transition duration-500">
                    <span class="absolute top-3 right-3 bg-sasaDark/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                        ${ev.category}
                    </span>
                </div>
                <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
                    <div>
                        <span class="text-xs font-bold text-sasaRed flex items-center gap-1 mb-1">
                            <i class="fa-regular fa-calendar"></i> ${ev.displayDate}
                        </span>
                        <h3 class="text-base font-extrabold text-sasaDark line-clamp-1">${ev.title}</h3>
                        <p class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <i class="fa-solid fa-location-dot text-gray-400"></i> ${ev.venue}
                        </p>
                    </div>
                    <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div>
                            <span class="text-[10px] text-gray-400 font-bold block uppercase">From</span>
                            <span class="text-base font-black text-sasaDark">KES ${minPrice.toLocaleString()}</span>
                        </div>
                        <button onclick="openBookingModal(${ev.id})" class="bg-sasaRed hover:bg-sasaRedHover text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md transition">
                            Get Ticket
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

// --- FILTERING LOGIC ---
function filterCategory(cat) {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.remove('bg-sasaRed', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    event.target.classList.remove('bg-gray-100', 'text-gray-700');
    event.target.classList.add('bg-sasaRed', 'text-white');

    if (cat === 'All') renderEventsGrid(events);
    else renderEventsGrid(events.filter(e => e.category === cat));
}

function handleSearch(query) {
    const q = query.toLowerCase();
    const filtered = events.filter(e => e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q));
    renderEventsGrid(filtered);
}

function applyFilters() {
    const dateVal = document.getElementById('dateFilter').value;
    const sortVal = document.getElementById('sortBy').value;
    let result = [...events];

    if (dateVal) {
        result = result.filter(e => e.date === dateVal);
    }
    if (sortVal === 'price-low') {
        result.sort((a,b) => Math.min(...a.tiers.map(t=>t.price)) - Math.min(...b.tiers.map(t=>t.price)));
    } else if (sortVal === 'price-high') {
        result.sort((a,b) => Math.min(...b.tiers.map(t=>t.price)) - Math.min(...a.tiers.map(t=>t.price)));
    }
    renderEventsGrid(result);
}

// --- BOOKING MODAL & M-PESA CHECKOUT ---
function openBookingModal(eventId) {
    selectedEvent = events.find(e => e.id === eventId);
    if (!selectedEvent) return;

    document.getElementById('modalEventTitle').innerText = selectedEvent.title;
    document.getElementById('modalEventVenue').innerText = `${selectedEvent.venue} | ${selectedEvent.displayDate}`;
    
    // Build Tier Options
    const tierBox = document.getElementById('tierOptions');
    tierBox.innerHTML = '';
    selectedEvent.tiers.forEach((t, idx) => {
        tierBox.innerHTML += `
            <label class="flex items-center justify-between p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-sasaRed transition">
                <div class="flex items-center gap-2">
                    <input type="radio" name="ticketTier" value="${idx}" ${idx===0?'checked':''} onchange="selectTier(${idx})" class="text-sasaRed focus:ring-sasaRed">
                    <span class="text-xs font-bold text-sasaDark">${t.name}</span>
                </div>
                <span class="text-xs font-black text-sasaRed">KES ${t.price.toLocaleString()}</span>
            </label>
        `;
    });

    selectedTierObj = selectedEvent.tiers[0];
    currentQty = 1;
    document.getElementById('ticketQty').innerText = currentQty;
    updateTotal();

    toggleModal('bookingModal');
}

function selectTier(idx) {
    selectedTierObj = selectedEvent.tiers[idx];
    updateTotal();
}

function adjustQty(amount) {
    currentQty = Math.max(1, currentQty + amount);
    document.getElementById('ticketQty').innerText = currentQty;
    updateTotal();
}

function updateTotal() {
    const total = selectedTierObj.price * currentQty;
    document.getElementById('totalAmountText').innerText = `KES ${total.toLocaleString()}`;
}

// --- M-PESA STK TRIGGER SIMULATION ---
function processMpesaPayment(e) {
    e.preventDefault();
    const btn = document.getElementById('payButton');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Triggering M-Pesa Push...`;

    const phone = document.getElementById('custPhone').value;
    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;

    // Simulate Daraja Network Latency (2.5s)
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay via M-Pesa Express`;
        
        // Create generated ticket record
        const newTicket = {
            uuid: `TICKET-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            eventId: selectedEvent.id,
            eventTitle: selectedEvent.title,
            venue: selectedEvent.venue,
            eventDate: selectedEvent.displayDate,
            tier: selectedTierObj.name,
            price: selectedTierObj.price * currentQty,
            customerName: name,
            phone: phone,
            email: email,
            mpesaRef: `QK${Math.floor(10000000 + Math.random() * 90000000)}`,
            isCheckedIn: false,
            checkInTime: null
        };

        ticketDatabase.unshift(newTicket);
        toggleModal('bookingModal');
        
        // Open Digital Pass View
        showTicketPass(newTicket);
        updateDashboardMetrics();
        renderDashboardTable();
    }, 2500);
}

// --- DIGITAL TICKET & QR CODE GENERATION ---
function showTicketPass(ticket) {
    document.getElementById('passEventTitle').innerText = ticket.eventTitle;
    document.getElementById('passEventDate').innerText = ticket.eventDate;
    document.getElementById('passUuid').innerText = ticket.uuid;
    document.getElementById('passName').innerText = ticket.customerName;
    document.getElementById('passTier').innerText = ticket.tier;
    document.getElementById('passVenue').innerText = ticket.venue;
    document.getElementById('passMpesa').innerText = ticket.mpesaRef;

    // Render QR Code using QRCode.js
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: ticket.uuid,
        width: 130,
        height: 130,
        colorDark: "#1A1A1A",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    toggleModal('ticketPassModal');
}

// --- GATEKEEPER QR SCANNER LOGIC ---
function handleManualVerify(e) {
    e.preventDefault();
    const input = document.getElementById('manualTicketUuid');
    const code = input.value.trim().toUpperCase();
    verifyTicketCode(code);
    input.value = '';
}

function verifyTicketCode(code) {
    const box = document.getElementById('scanResultBox');
    box.classList.remove('hidden', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-800', 'bg-red-50', 'border-red-200', 'text-red-800');

    const ticket = ticketDatabase.find(t => t.uuid.toUpperCase() === code);

    if (!ticket) {
        box.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
        box.innerHTML = `
            <div class="flex items-center gap-2 font-bold text-sm">
                <i class="fa-solid fa-circle-xmark text-red-600 text-base"></i> INVALID TICKET TOKEN
            </div>
            <p>No ticket record matching <b>${code}</b> found in the PostgreSQL backend.</p>
        `;
        addGateLog(code, "FAILED: Invalid Code", "red");
        return;
    }

    if (ticket.isCheckedIn) {
        box.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-900');
        box.innerHTML = `
            <div class="flex items-center gap-2 font-bold text-sm">
                <i class="fa-solid fa-triangle-exclamation text-amber-600 text-base"></i> WARNING: ALREADY CHECKED IN
            </div>
            <p>Ticket <b>${ticket.uuid}</b> (${ticket.customerName}) was already verified at <b>${ticket.checkInTime}</b>. Entry Denied.</p>
        `;
        addGateLog(ticket.uuid, `DUPLICATE ENTRY (${ticket.customerName})`, "amber");
        return;
    }

    // Mark check-in
    ticket.isCheckedIn = true;
    ticket.checkInTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    box.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-800');
    box.innerHTML = `
        <div class="flex items-center gap-2 font-bold text-sm">
            <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i> ENTRY AUTHORIZED
        </div>
        <div class="mt-1 space-y-0.5">
            <p><b>Attendee:</b> ${ticket.customerName}</p>
            <p><b>Event:</b> ${ticket.eventTitle}</p>
            <p><b>Tier:</b> ${ticket.tier}</p>
        </div>
    `;

    addGateLog(ticket.uuid, `AUTHORIZED - ${ticket.customerName}`, "emerald");
    updateDashboardMetrics();
    renderDashboardTable();
}

function addGateLog(code, message, statusColor) {
    const logs = document.getElementById('recentScansList');
    const time = new Date().toLocaleTimeString();
    logs.innerHTML = `
        <div class="flex justify-between items-center text-[11px] p-2 rounded-lg bg-gray-50 border border-gray-100">
            <span class="font-mono font-bold text-gray-700">${code}</span>
            <span class="font-semibold text-${statusColor}-600">${message}</span>
            <span class="text-gray-400">${time}</span>
        </div>
    ` + logs.innerHTML;
}

// --- ORGANIZER DASHBOARD METRICS & CHARTS ---
function updateDashboardMetrics() {
    const totalRev = ticketDatabase.reduce((acc, t) => acc + t.price, 0);
    const totalSold = ticketDatabase.length;
    const totalCheckins = ticketDatabase.filter(t => t.isCheckedIn).length;

    document.getElementById('dashGrossRevenue').innerText = `KES ${totalRev.toLocaleString()}`;
    document.getElementById('dashTicketsSold').innerText = totalSold.toString();
    document.getElementById('dashGateCheckins').innerText = totalCheckins.toString();
}

function renderDashboardTable() {
    const tbody = document.getElementById('dashboardTransactionsTable');
    tbody.innerHTML = '';

    ticketDatabase.forEach(t => {
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 font-mono font-bold text-sasaDark">${t.uuid}</td>
                <td class="p-4 font-semibold">${t.customerName}</td>
                <td class="p-4">${t.eventTitle}</td>
                <td class="p-4 font-bold text-sasaRed">${t.tier}</td>
                <td class="p-4 font-mono text-emerald-600">${t.mpesaRef}</td>
                <td class="p-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${t.isCheckedIn ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
                        ${t.isCheckedIn ? 'Checked-In' : 'Valid Pass'}
                    </span>
                </td>
                <td class="p-4 text-gray-400">${t.checkInTime || 'Pending Entry'}</td>
            </tr>
        `;
    });
}

function initDashboardCharts() {
    // Revenue Chart
    const ctxRev = document.getElementById('revenueChart').getContext('2d');
    revenueChartInstance = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Gross Sales (KES)',
                data: [12000, 25000, 18000, 42000, 65000, 98000, 120000],
                borderColor: '#D9232D',
                backgroundColor: 'rgba(217, 35, 45, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    // Tier Chart
    const ctxTier = document.getElementById('tierChart').getContext('2d');
    tierChartInstance = new Chart(ctxTier, {
        type: 'doughnut',
        data: {
            labels: ['Regular', 'VIP', 'VVIP'],
            datasets: [{
                data: [65, 25, 10],
                backgroundColor: ['#1A1A1A', '#D9232D', '#F59E0B']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// --- NEW EVENT CREATION ---
function handleCreateEvent(e) {
    e.preventDefault();
    const title = document.getElementById('newEventTitle').value;
    const category = document.getElementById('newEventCat').value;
    const venue = document.getElementById('newEventVenue').value;
    const date = document.getElementById('newEventDate').value;
    const price = parseFloat(document.getElementById('newEventPrice').value);
    const image = document.getElementById('newEventImg').value;

    const newEv = {
        id: events.length + 1,
        title,
        category,
        venue,
        date,
        displayDate: new Date(date).toDateString(),
        image,
        tiers: [
            { name: "Standard Entry", price: price },
            { name: "VIP Experience", price: price * 2 }
        ]
    };

    events.unshift(newEv);
    renderEventsGrid(events);
    toggleModal('createEventModal');
    alert('New event published successfully to public storefront!');
}

// --- UTILS ---
function toggleModal(modalId) {
    const m = document.getElementById(modalId);
    m.classList.toggle('hidden');
}

function exportReport() {
    alert('Financial & Attendee log CSV report exported for accounting.');
}