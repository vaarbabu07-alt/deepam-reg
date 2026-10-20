/**
 * Rotary Event Registration - Administrator Dashboard Logic
 * Handles session authentication, KPI stats rendering, live filtering, status changes, and CSV exports.
 */

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    loginSection: document.getElementById('login-section'),
    dashboardSection: document.getElementById('dashboard-section'),
    adminNavActions: document.getElementById('admin-nav-actions'),
    loggedInUser: document.getElementById('logged-in-user'),
    loginForm: document.getElementById('admin-login-form'),
    loginError: document.getElementById('login-error'),
    adminUser: document.getElementById('admin-user'),
    adminPass: document.getElementById('admin-pass'),
    btnLogout: document.getElementById('btn-logout'),

    // KPI cards
    statTotalReg: document.getElementById('stat-total-reg'),
    statTotalAttendees: document.getElementById('stat-total-attendees'),

    statFoodBreakdown: document.getElementById('stat-food-breakdown'),
    statPaidAmount: document.getElementById('stat-paid-amount'),
    statPendingAmount: document.getElementById('stat-pending-amount'),

    // Filters
    searchInput: document.getElementById('search-input'),
    statusFilter: document.getElementById('status-filter'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnExportCsv: document.getElementById('btn-export-csv'),

    // Table
    tableBody: document.getElementById('table-body'),

    // Modals
    detailsModal: document.getElementById('details-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBodyContent: document.getElementById('modal-body-content'),
    modalCloseBtn: document.getElementById('modal-close-btn'),

    proofModal: document.getElementById('proof-modal'),
    proofModalTitle: document.getElementById('proof-modal-title'),
    proofModalBody: document.getElementById('proof-modal-body'),
    proofModalCloseBtn: document.getElementById('proof-modal-close-btn')
  };

  let allRegistrations = [];

  /**
   * Check if current session is authenticated.
   */
  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/check-auth');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        showDashboard(data.username);
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  function showDashboard(username) {
    elements.loginSection.style.display = 'none';
    elements.dashboardSection.style.display = 'block';
    elements.adminNavActions.style.display = 'flex';
    elements.loggedInUser.textContent = `Logged in as ${username || 'Admin'}`;
    loadStats();
    loadRegistrations();
  }

  function showLogin() {
    elements.dashboardSection.style.display = 'none';
    elements.adminNavActions.style.display = 'none';
    elements.loginSection.style.display = 'block';
  }

  /**
   * Handle Admin Login
   */
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elements.loginError.style.display = 'none';

    const username = elements.adminUser.value.trim();
    const password = elements.adminPass.value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        elements.adminPass.value = '';
        showDashboard(data.username);
      } else {
        elements.loginError.textContent = data.message || 'Invalid login credentials.';
        elements.loginError.style.display = 'block';
      }
    } catch (err) {
      elements.loginError.textContent = 'Network error while signing in.';
      elements.loginError.style.display = 'block';
    }
  });

  /**
   * Handle Logout
   */
  elements.btnLogout.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  /**
   * Fetch KPI statistics
   */
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const { stats } = await res.json();
        if (elements.statTotalReg) elements.statTotalReg.textContent = (stats.totalRegistrations || 0).toLocaleString('en-IN');
        if (elements.statTotalAttendees) elements.statTotalAttendees.textContent = (stats.totalAttendees || (stats.totalRotarians + (stats.totalAnns||0) + (stats.totalAnnettes||0)) || 0).toLocaleString('en-IN');

        if (elements.statFoodBreakdown) elements.statFoodBreakdown.textContent = `${stats.totalVeg || 0} V / ${stats.totalNonVeg || 0} NV`;
        if (elements.statPaidAmount) elements.statPaidAmount.textContent = `₹${(stats.totalPaidAmount || 0).toLocaleString('en-IN')}`;
        if (elements.statPendingAmount) elements.statPendingAmount.textContent = `₹${(stats.totalPendingAmount || 0).toLocaleString('en-IN')}`;
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  /**
   * Fetch registrations with search & status filters
   */
  async function loadRegistrations() {
    const search = elements.searchInput.value.trim();
    const status = elements.statusFilter.value;

    const params = new URLSearchParams({ search, status });
    try {
      const res = await fetch(`/api/admin/registrations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        allRegistrations = data.records || [];
        renderTable(allRegistrations);
      }
    } catch (err) {
      elements.tableBody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: #DC2626; padding: 24px;">Failed to load registrations.</td></tr>`;
    }
  }

  /**
   * Render table rows
   */
  function renderTable(records) {
    if (!records || records.length === 0) {
      elements.tableBody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: #64748B; padding: 32px;">No registrations found matching your criteria.</td></tr>`;
      return;
    }

    elements.tableBody.innerHTML = records.map(r => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const statusBadge = `<span class="badge badge-${r.paymentStatus.toLowerCase()}">${r.paymentStatus}</span>`;
      // Build inline Member Details HTML
      const members = [];
      members.push({
        name: r.fullName || 'Not provided',
        phone: r.mobileNumber || 'Not provided'
      });

      if (r.additionalMembers && Array.isArray(r.additionalMembers)) {
        r.additionalMembers.forEach(m => {
          members.push({
            name: m.name || 'Not provided',
            phone: m.phone || 'Not provided'
          });
        });
      }

      const totalMembers = parseInt(r.rotariansCount, 10) || members.length || 1;

      let memberListHtml = '';
      members.forEach((m, idx) => {
        memberListHtml += `
          <div style="font-size: 12px; margin-bottom: 4px; line-height: 1.35; padding: 3px 6px; background: #F8FAFC; border-radius: 4px; border: 1px solid #E2E8F0;">
            <div style="font-weight: 700; color: #002244;">${idx + 1}. ${escapeHtml(m.name)}</div>
            <div style="color: #64748B; font-family: monospace; font-size: 11px;">📞 ${escapeHtml(m.phone)}</div>
          </div>
        `;
      });

      const memberDetailsCol = `
        <div style="min-width: 170px; max-width: 260px; max-height: 150px; overflow-y: auto;">
          <div style="font-size: 11px; font-weight: 800; color: #002244; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
            Members: ${totalMembers}
          </div>
          ${memberListHtml}
        </div>
      `;

      const screenshotLink = r.paymentScreenshot 
        ? `<button type="button" class="btn-action" style="background:#002244; color:#fff; border:none; padding:4px 8px; font-size:12px;" onclick="window.viewProof('${r.registrationId}')">View Proof</button>`
        : `<button type="button" class="btn-action" style="background:#f1f5f9; color:#94a3b8; border:none; padding:4px 8px; font-size:12px;" onclick="window.viewProof('${r.registrationId}')">View Proof</button>`;

      return `
        <tr>
          <td><strong style="font-family: monospace; color: #002244;">${r.registrationId}</strong></td>
          <td style="font-size: 12.5px; white-space: nowrap;">${dateStr}</td>
          <td>
            <strong>${escapeHtml(r.fullName)}</strong><br>
            <span style="font-size: 12px; color: #64748B;">${escapeHtml(r.email)}</span>
          </td>
          <td>${escapeHtml(r.mobileNumber)}</td>
          <td>
            ${escapeHtml(r.rotaryClub)}<br>
            <span style="font-size: 11.5px; color: #64748B;">${escapeHtml(r.rotaryDistrict)}</span>
          </td>
          <td style="text-align: center; font-size: 13px;">
            <span style="font-weight:700; color: #002244; font-size: 13.5px;">${totalMembers}</span>
            <div style="font-size: 11px; color: #64748B;">Member${totalMembers > 1 ? 's' : ''}</div>
          </td>
          <td>${memberDetailsCol}</td>
          <td style="text-align: center; font-size: 12.5px;">
            <span style="color:#16A34A; font-weight:600;">${r.vegCount || 0} V</span> / 
            <span style="color:#DC2626; font-weight:600;">${r.nonVegCount || 0} NV</span>
          </td>
          <td style="font-weight: 800; color: #002244;">₹${r.totalAmount.toLocaleString('en-IN')}</td>
          <td><span style="font-family: monospace; font-size: 12.5px; background: #F1F5F9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(r.utr)}</span></td>
          <td>${statusBadge}</td>
          <td>${screenshotLink}</td>
          <td>
            <div class="action-group">
              ${r.paymentStatus !== 'PAID' ? `<button type="button" class="btn-action btn-status-paid" onclick="window.updateRegStatus('${r.registrationId}', 'PAID')">Approve</button>` : ''}
              ${r.paymentStatus !== 'REJECTED' ? `<button type="button" class="btn-action btn-status-reject" onclick="window.updateRegStatus('${r.registrationId}', 'REJECTED')">Reject</button>` : ''}
              ${r.paymentStatus !== 'PENDING' ? `<button type="button" class="btn-action" style="background:#f1f5f9;" onclick="window.updateRegStatus('${r.registrationId}', 'PENDING')">Reset</button>` : ''}
              <button type="button" class="btn-action btn-details" onclick="window.viewDetails('${r.registrationId}')">Details</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Status updater
   */
  window.updateRegStatus = async function(registrationId, newStatus) {
    if (!confirm(`Are you sure you want to mark ${registrationId} as ${newStatus}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, status: newStatus })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        loadStats();
        loadRegistrations();
      } else {
        alert(data.message || 'Failed to update status.');
      }
    } catch (err) {
      alert('Network error while updating status.');
    }
  };

  /**
   * View Details Modal
   */
  window.viewDetails = function(registrationId) {
    const reg = allRegistrations.find(r => r.registrationId === registrationId);
    if (!reg) return;

    elements.modalTitle.textContent = `Registration Details - ${reg.registrationId}`;
    
    const screenshotHtml = reg.paymentScreenshot 
      ? `<div style="margin-top: 14px;">
           <strong>Payment Proof Screenshot:</strong><br>
           <a href="${reg.paymentScreenshot}" target="_blank">
             <img src="${reg.paymentScreenshot}" class="proof-img" alt="Payment Screenshot">
           </a>
         </div>`
      : `<p style="margin-top: 10px; color: #64748B;">No payment screenshot uploaded.</p>`;

    // Build Member Details HTML
    const members = [];
    members.push({
      name: reg.fullName || 'Not provided',
      phone: reg.mobileNumber || 'Not provided'
    });

    if (reg.additionalMembers && Array.isArray(reg.additionalMembers)) {
      reg.additionalMembers.forEach(m => {
        members.push({
          name: m.name || 'Not provided',
          phone: m.phone || 'Not provided'
        });
      });
    }

    const totalMembers = parseInt(reg.rotariansCount, 10) || members.length || 1;

    let memberRowsHtml = '';
    members.forEach((m, idx) => {
      memberRowsHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: ${idx < members.length - 1 ? '1px dashed #E2E8F0' : 'none'}; font-size: 13.5px;">
          <span><strong>Member ${idx + 1}:</strong> ${escapeHtml(m.name)}</span>
          <span style="font-family: monospace; color: #002244; font-weight: 600; background: #F1F5F9; padding: 2px 8px; border-radius: 4px;">${escapeHtml(m.phone)}</span>
        </div>`;
    });

    elements.modalBodyContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; margin-bottom: 16px;">
        <div><strong>Participant Name:</strong> ${escapeHtml(reg.fullName)}</div>
        <div><strong>Mobile:</strong> ${escapeHtml(reg.mobileNumber)}</div>
        <div><strong>Email:</strong> ${escapeHtml(reg.email)}</div>
        <div><strong>Club:</strong> ${escapeHtml(reg.rotaryClub)}</div>
        <div><strong>District:</strong> ${escapeHtml(reg.rotaryDistrict)}</div>
        <div><strong>Current Status:</strong> <span class="badge badge-${reg.paymentStatus.toLowerCase()}">${reg.paymentStatus}</span></div>

        <!-- MEMBER DETAILS SECTION -->
        <div style="grid-column: span 2; background: #F0F4FF; padding: 12px 14px; border-radius: 8px; border-left: 4px solid #002244; border: 1px solid #C7D2FE;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 700; color: #002244; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Member Details</span>
            <span style="font-size: 12px; background: #002244; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Total: ${totalMembers} Member${totalMembers > 1 ? 's' : ''}</span>
          </div>
          <div style="background: #ffffff; border-radius: 6px; padding: 6px 12px; border: 1px solid #E2E8F0;">
            ${memberRowsHtml}
          </div>
        </div>
        
        <div style="grid-column: span 2; background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #E2E8F0;">
          <div style="font-weight: 700; margin-bottom: 6px; color: #002244;">Registration Details:</div>
          <div>• Total Members Attending: <strong>${totalMembers}</strong></div>
          <div>• Registration Fee: <strong>₹${reg.rotarianFee || 1200} per member</strong></div>
          <div style="margin-top: 6px; font-size: 15px; font-weight: 800; color: #002244;">Total Amount: ₹${reg.totalAmount.toLocaleString('en-IN')}</div>
        </div>

        <div style="grid-column: span 2; background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #E2E8F0;">
          <div style="font-weight: 700; margin-bottom: 4px; color: #002244;">Catering Food Counts:</div>
          <div>• Vegetarian: <strong>${reg.vegCount || 0}</strong> | Non-Vegetarian: <strong>${reg.nonVegCount || 0}</strong></div>
        </div>

        <div style="grid-column: span 2;">
          <strong>UPI UTR / Reference:</strong> 
          <code style="background: #F1F5F9; padding: 3px 8px; border-radius: 4px; font-size: 14px;">${escapeHtml(reg.utr || 'Not provided')}</code>
        </div>
        <div style="grid-column: span 2; font-size: 12.5px; color: #64748B;">
          Email Status: Participant: <strong>${reg.participantEmailStatus || 'N/A'}</strong> | Admin: <strong>${reg.adminEmailStatus || 'N/A'}</strong>
        </div>
      </div>
      ${screenshotHtml}
      <div style="margin-top: 20px; text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
        <button type="button" class="btn-action btn-status-paid" style="padding: 8px 14px;" onclick="window.updateRegStatus('${reg.registrationId}', 'PAID'); elements.detailsModal.style.display='none';">Mark as PAID</button>
        <button type="button" class="btn-action btn-status-reject" style="padding: 8px 14px;" onclick="window.updateRegStatus('${reg.registrationId}', 'REJECTED'); elements.detailsModal.style.display='none';">Mark as REJECTED</button>
      </div>
    `;

    elements.detailsModal.style.display = 'flex';
  };

  // Close details modal
  elements.modalCloseBtn.addEventListener('click', () => {
    elements.detailsModal.style.display = 'none';
  });
  elements.detailsModal.addEventListener('click', (e) => {
    if (e.target === elements.detailsModal) {
      elements.detailsModal.style.display = 'none';
    }
  });

  /**
   * Dedicated Payment Proof Modal Viewer
   */
  window.viewProof = function(registrationId) {
    const reg = allRegistrations.find(r => r.registrationId === registrationId);
    if (!reg) return;

    elements.proofModalTitle.textContent = `Payment Proof - ${reg.registrationId}`;

    if (!reg.paymentScreenshot || String(reg.paymentScreenshot).trim() === '') {
      elements.proofModalBody.innerHTML = `
        <div style="padding: 30px 20px; color: #64748B;">
          <div style="font-size: 36px; margin-bottom: 10px;">📄</div>
          <div style="font-size: 15px; font-weight: 600; color: #334155;">Payment proof is not available for this registration.</div>
          <div style="font-size: 13px; margin-top: 6px;">Participant: ${escapeHtml(reg.fullName)} (${escapeHtml(reg.registrationId)})</div>
        </div>
      `;
    } else {
      elements.proofModalBody.innerHTML = `
        <div style="text-align: center;">
          <img src="${reg.paymentScreenshot}" alt="Payment Proof" style="max-width: 100%; max-height: 70vh; border-radius: 8px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: inline-block;">
          <div style="margin-top: 12px; font-size: 13px; color: #475569;">
            <strong>Participant:</strong> ${escapeHtml(reg.fullName)} | <strong>UTR:</strong> ${escapeHtml(reg.utr || 'Not provided')}
          </div>
          <div style="margin-top: 10px;">
            <a href="${reg.paymentScreenshot}" target="_blank" download="Proof-${reg.registrationId}" class="btn-action" style="display:inline-block; padding: 6px 14px; font-size: 12.5px; text-decoration:none; background: #002244; color:#fff;">Open Full Size</a>
          </div>
        </div>
      `;
    }

    elements.proofModal.style.display = 'flex';
  };

  // Close proof modal
  elements.proofModalCloseBtn.addEventListener('click', () => {
    elements.proofModal.style.display = 'none';
  });
  elements.proofModal.addEventListener('click', (e) => {
    if (e.target === elements.proofModal) {
      elements.proofModal.style.display = 'none';
    }
  });

  // Debounced search
  let searchTimeout = null;
  elements.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadRegistrations, 300);
  });

  elements.statusFilter.addEventListener('change', loadRegistrations);
  elements.btnRefresh.addEventListener('click', () => {
    loadStats();
    loadRegistrations();
  });

  // Export CSV
  elements.btnExportCsv.addEventListener('click', () => {
    window.location.href = '/api/admin/export-csv';
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize
  checkAuth();
});
