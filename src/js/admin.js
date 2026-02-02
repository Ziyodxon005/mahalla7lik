import '../styles/main.css';
import { supabase } from './supabase.js';
import { login, logout } from './auth.js';
import { showToast } from './utils.js';

// --- Admin App Logic ---

const adminApp = document.getElementById('admin-app');
const adminAuth = document.getElementById('admin-auth');
const adminRequestsList = document.getElementById('admin-requests-list');

// Filters
const filtersContainer = document.getElementById('filters-container');
let currentFilter = 'all';

// Chat Elements
const chatModal = document.getElementById('chat-modal');
const chatHeaderInfo = document.getElementById('chat-header-info');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
let activeChatId = null;
let chatChannel = null;

let currentAdmin = null;

// --- Global Actions ---
let targetRequestId = null;

window.openStatusModal = (id) => {
    targetRequestId = id;
    const modal = document.getElementById('status-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('reject-input-area')?.classList.add('hidden');
        const reasonInput = document.getElementById('reject-reason-text');
        if (reasonInput) reasonInput.value = '';
    }
};

window.closeStatusModal = () => {
    const modal = document.getElementById('status-modal');
    if (modal) modal.classList.add('hidden');
    targetRequestId = null;
};

window.showRejectReason = () => {
    document.getElementById('reject-input-area')?.classList.remove('hidden');
};

window.confirmStatusUpdate = async (status) => {
    if (!targetRequestId) return;

    if (status === 'rejected') {
        const reasonInput = document.getElementById('reject-reason-text');
        const reason = reasonInput ? reasonInput.value.trim() : '';

        if (!reason) {
            showToast("Rad etish sababini yozing", 'error');
            return;
        }

        try {
            const { error: updateError } = await supabase.from('murojaatlar').update({ status }).eq('id', targetRequestId);
            if (updateError) throw updateError;

            await supabase.from('messages').insert([{
                murojaat_id: targetRequestId,
                sender_id: currentAdmin.id,
                text: `RAD ETILDI: ${reason}`
            }]);

            showToast("Rad etildi", 'success');
            window.closeStatusModal();
            loadRequests();
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    const { error } = await supabase.from('murojaatlar').update({ status }).eq('id', targetRequestId);
    if (!error) {
        showToast("Status yangilandi", 'success');
        window.closeStatusModal();
        loadRequests();
    } else {
        showToast(error.message, 'error');
    }
};

window.openEmbeddedChat = async (id, title, status, requesterName) => {
    activeChatId = id;

    if (chatForm) chatForm.classList.remove('opacity-50', 'pointer-events-none');

    if (chatHeaderInfo) {
        const statusText = {
            'pending': 'Kutilmoqda',
            'progress': 'Jarayonda',
            'done': 'Bajarildi',
            'rejected': 'Rad etildi'
        }[status] || status;

        chatHeaderInfo.innerHTML = `
            <p class="text-[10px] text-primary font-bold uppercase mb-1">#${id.slice(0, 6)} • ${statusText}</p>
            <h4 class="font-bold text-black text-sm">${requesterName || 'Foydalanuvchi'}</h4>
            <p class="text-xs text-black truncate">${title}</p>
        `;
    }

    if (window.openChatModal) window.openChatModal();

    await loadMessagesForPanel(id);
};


async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile && profile.role !== 'user') {
            currentAdmin = { ...user, profile };
            showDashboard();
        } else {
            await logout();
            showLogin();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    adminAuth.classList.remove('hidden');
    adminApp?.classList.add('hidden');
}

function showDashboard() {
    adminAuth.classList.add('hidden');
    adminApp?.classList.remove('hidden');

    const roleDisplay = document.getElementById('admin-role-display');
    const sidebarRoleLabel = document.getElementById('sidebar-role-label');
    const mobileSidebarRole = document.getElementById('mobile-sidebar-role');
    const mainContent = document.querySelector('#admin-app > main');
    const superAdminDashboard = document.getElementById('super-admin-dashboard');

    if (currentAdmin) {
        const roleKey = currentAdmin.profile.role;
        const roleName = ROLE_NAMES[roleKey] || roleKey.replace(/_/g, ' ').toUpperCase();

        if (roleDisplay) roleDisplay.textContent = roleName === 'Super Admin' ? 'SUPER ADMIN' : roleName;
        if (sidebarRoleLabel) sidebarRoleLabel.textContent = roleName;
        if (mobileSidebarRole) mobileSidebarRole.textContent = roleName;

        // Super Admin uchun maxsus dashboard
        // Super Admin uchun maxsus dashboard
        if (currentAdmin.profile.role === 'super_admin') {
            mainContent?.classList.add('hidden');
            superAdminDashboard?.classList.remove('hidden');
            // Statistika tugmalarini ko'rsatish
            document.getElementById('sidebar-stats-btn')?.classList.remove('hidden');
            document.getElementById('mobile-stats-btn')?.classList.remove('hidden');
            // Murojaatlar tugmalarini faol (neu-active) qilish/olish JS orqali boshqariladi
            updateSidebarActiveStates(true);

            // Chat panelni yashirish (super admin faqat kuzatadi)
            document.getElementById('chat-modal')?.classList.add('hidden');
            loadSuperAdminStats();
        } else {
            mainContent?.classList.remove('hidden');
            superAdminDashboard?.classList.add('hidden');
            document.getElementById('chat-modal')?.classList.add('hidden');
            // Statistika tugmalarini yashirish (oddiy admin uchun shart emas)
            document.getElementById('sidebar-stats-btn')?.classList.add('hidden');
            document.getElementById('mobile-stats-btn')?.classList.add('hidden');
            document.getElementById('sidebar-murojaatlar-btn')?.classList.remove('hidden');
            updateSidebarActiveStates(false);
            loadRequests();
        }
    } else {
        loadRequests();
    }
}

// Auth Listeners
const loginForm = document.getElementById('admin-login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('admin-phone').value;
        const password = document.getElementById('admin-password').value;

        try {
            const { user } = await login(phone, password);
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile.role !== 'user') {
                    checkAdmin();
                } else {
                    showToast("Admin huquqi yo'q", 'error');
                    await logout();
                }
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

const logoutBtn = document.getElementById('admin-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await logout();
        window.location.reload();
    });
}

// --- Filter Logic ---
if (filtersContainer) {
    filtersContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('neu-active', 'text-primary');
            b.classList.add('text-black');
        });

        btn.classList.add('neu-active', 'text-primary');
        btn.classList.remove('text-black');

        currentFilter = btn.dataset.filter;
        loadRequests();
    });
}

// --- Search Logic ---
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        loadRequests();
    });
}

// --- Requests Feed ---

async function loadRequests() {
    if (!currentAdmin) return;

    let query = supabase
        .from('murojaatlar')
        .select('*, profiles(full_name, phone)')
        .order('created_at', { ascending: false });

    if (currentAdmin.profile.role !== 'super_admin') {
        query = query.eq('target_role', currentAdmin.profile.role);
    }

    if (currentFilter !== 'all') {
        query = query.eq('status', currentFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Load requests error:', error);
        return;
    }

    const searchVal = searchInput?.value?.toLowerCase() || '';

    let filteredData = data || [];
    if (searchVal) {
        filteredData = filteredData.filter(r =>
            (r.title || '').toLowerCase().includes(searchVal) ||
            (r.id || '').toLowerCase().includes(searchVal) ||
            (r.profiles?.full_name || '').toLowerCase().includes(searchVal)
        );
    }

    renderRequests(filteredData);
}

function renderRequests(data) {
    if (!adminRequestsList) return;

    if (!data || data.length === 0) {
        adminRequestsList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-black">
                <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
                <p>Murojaatlar topilmadi</p>
            </div>
        `;
        return;
    }

    adminRequestsList.innerHTML = '';

    data.forEach((req, index) => {
        const div = document.createElement('div');
        div.className = 'neu-card rounded-2xl p-6 flex flex-col md:flex-row gap-6 hover:scale-[1.01] transition-transform request-card';
        div.style.animationDelay = `${index * 0.05}s`;

        const statusColors = {
            'pending': 'bg-amber-100 text-amber-600',
            'progress': 'bg-blue-100 text-blue-600',
            'done': 'bg-green-100 text-green-600',
            'rejected': 'bg-red-100 text-red-600'
        }[req.status] || 'bg-gray-100';

        const statusText = {
            'pending': 'Kutilmoqda',
            'progress': 'Jarayonda',
            'done': 'Bajarildi',
            'rejected': 'Rad etildi'
        }[req.status] || req.status;

        const requesterName = req.profiles?.full_name || 'Noma\'lum';

        const imgHtml = req.image_url
            ? `<a href="${req.image_url}" target="_blank" class="block w-full md:w-48 h-32 rounded-xl bg-cover bg-center neu-inset flex-shrink-0" style="background-image: url('${req.image_url}')"></a>`
            : `<div class="w-full md:w-48 h-32 rounded-xl neu-inset flex items-center justify-center text-black flex-shrink-0"><span class="material-symbols-outlined text-4xl">image</span></div>`;

        div.innerHTML = `
            ${imgHtml}
            <div class="flex-1 flex flex-col justify-between min-w-0">
                <div>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="px-2 py-0.5 rounded-full ${statusColors} text-[10px] font-bold uppercase">${statusText}</span>
                        <span class="text-black text-xs">#${req.id.slice(0, 6)}</span>
                    </div>
                    <h3 class="text-lg font-bold text-black truncate">${req.title}</h3>
                    <p class="text-black text-sm mt-1 line-clamp-2">${req.description}</p>
                </div>
                <div class="flex items-center justify-between mt-4 flex-wrap gap-2">
                    <div class="flex items-center gap-3 text-xs text-black">
                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span> ${new Date(req.created_at).toLocaleDateString()}</span>
                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">person</span> ${requesterName}</span>
                        <a href="https://maps.google.com/?q=${req.lat},${req.lng}" target="_blank" class="flex items-center gap-1 text-blue-500 hover:underline">
                            <span class="material-symbols-outlined text-sm">location_on</span> Xarita
                        </a>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="window.openStatusModal('${req.id}')" class="px-4 py-2 rounded-xl neu-btn text-black text-xs font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-sm">edit</span> Status
                        </button>
                        
                        <button onclick="window.openEmbeddedChat('${req.id}', '${req.title.replace(/'/g, "\\'")}', '${req.status}', '${requesterName.replace(/'/g, "\\'")}')" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1 hover:brightness-110 transition">
                            <span class="material-symbols-outlined text-sm">chat</span> Yozish
                        </button>
                    </div>
                </div>
            </div>
        `;
        adminRequestsList.appendChild(div);
    });
}


// --- Chat Logic with optimistic updates ---

async function loadMessagesForPanel(id) {
    if (!chatMessages) return;
    chatMessages.innerHTML = '<p class="text-center text-black text-sm py-4">Yuklanmoqda...</p>';

    // Unsubscribe from previous channel
    if (chatChannel) {
        await supabase.removeChannel(chatChannel);
        chatChannel = null;
    }

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('murojaat_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Chat load error:', error);
            chatMessages.innerHTML = '<p class="text-center text-red-400 text-sm py-4">Xatolik yuz berdi</p>';
            return;
        }

        chatMessages.innerHTML = '';

        if (messages && messages.length > 0) {
            messages.forEach(msg => appendMessageToPanel(msg));
        } else {
            chatMessages.innerHTML = '<p class="text-center text-black text-sm py-4">Hali xabar yo\'q</p>';
        }

        // Subscribe realtime
        chatChannel = supabase.channel(`admin-chat-realtime-${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `murojaat_id=eq.${id}`
            }, (payload) => {
                console.log('Admin realtime message:', payload);
                // Only append if not from current admin (avoid duplicates)
                if (payload.new.sender_id !== currentAdmin.id) {
                    const noMsg = chatMessages.querySelector('p.text-center');
                    if (noMsg) noMsg.remove();
                    appendMessageToPanel(payload.new);
                }
            })
            .subscribe((status) => {
                console.log('Admin subscription status:', status);
            });

    } catch (err) {
        console.error('Chat error:', err);
        chatMessages.innerHTML = '<p class="text-center text-red-400 text-sm py-4">Xatolik</p>';
    }
}

function appendMessageToPanel(msg, isOptimistic = false) {
    if (!chatMessages || !currentAdmin) return;

    // Remove "no messages" placeholder
    const noMsg = chatMessages.querySelector('p.text-center');
    if (noMsg) noMsg.remove();

    const isMe = msg.sender_id === currentAdmin.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.id = `msg-${msg.id || 'temp-' + Date.now()}`;

    if (isMe) {
        div.className = 'flex flex-col items-end gap-1 max-w-[85%] ml-auto chat-msg';
        const checkIcon = isOptimistic ? 'done' : 'done_all';
        const checkColor = isOptimistic ? 'text-black' : 'text-primary';
        div.innerHTML = `
            <div class="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm shadow-md">
                ${msg.text}
            </div>
            <div class="flex items-center gap-1 mr-1">
                <span class="text-[10px] text-black">${time}</span>
                <span class="material-symbols-outlined text-xs ${checkColor}" id="check-${msg.id || 'temp'}">${checkIcon}</span>
            </div>
        `;
    } else {
        div.className = 'flex flex-col items-start gap-1 max-w-[85%] chat-msg';
        div.innerHTML = `
            <div class="neu-inset rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-black">
                ${msg.text}
            </div>
            <span class="text-[10px] text-black ml-1">${time}</span>
        `;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeChatId || !chatInput || !chatInput.value.trim()) return;

        const text = chatInput.value.trim();
        chatInput.value = '';

        // Create temp message for optimistic update
        const tempMsg = {
            id: 'temp-' + Date.now(),
            murojaat_id: activeChatId,
            sender_id: currentAdmin.id,
            text: text,
            created_at: new Date().toISOString()
        };

        // Show immediately
        appendMessageToPanel(tempMsg, true);

        // Show loading on button
        const sendBtn = chatForm.querySelector('button[type="submit"]');
        if (sendBtn) {
            sendBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';
            sendBtn.disabled = true;
        }

        try {
            const { data, error } = await supabase.from('messages').insert([{
                murojaat_id: activeChatId,
                sender_id: currentAdmin.id,
                text: text
            }]).select().single();

            if (error) {
                console.error('Send message error:', error);
                document.getElementById(`msg-${tempMsg.id}`)?.remove();
                showToast("Xabar yuborilmadi", 'error');
            } else {
                // Update check to double
                const tempCheck = document.getElementById('check-temp');
                if (tempCheck) {
                    tempCheck.textContent = 'done_all';
                    tempCheck.classList.remove('text-black');
                    tempCheck.classList.add('text-primary');
                }
            }
        } catch (err) {
            console.error('Send error:', err);
            document.getElementById(`msg-${tempMsg.id}`)?.remove();
            showToast("Xabar yuborilmadi", 'error');
        } finally {
            if (sendBtn) {
                sendBtn.innerHTML = '<span class="material-symbols-outlined text-lg">send</span>';
                sendBtn.disabled = false;
            }
        }
    });
}

// --- SUPER ADMIN DASHBOARD ---

const ROLE_NAMES = {
    'rais': 'Mahalla Raisi',
    'yoshlar_yetakchisi': 'Yoshlar Yetakchisi',
    'ijtimoiy_xodim': 'Ijtimoiy Xodim',
    'inspektor': 'Profilaktika Inspektori',
    'hokim_yordamchisi': 'Hokim Yordamchisi',
    'soliq_inspektori': 'Soliq Inspektori',
    'ayollar_faoli': 'Ayollar Faoli',
    'super_admin': 'Super Admin'
};

let showingDashboard = true;

window.toggleDashboard = () => {
    const mainContent = document.querySelector('#admin-app > main');
    const superAdminDashboard = document.getElementById('super-admin-dashboard');

    if (showingDashboard) {
        // Murojaatlarga o'tish
        mainContent?.classList.remove('hidden');
        superAdminDashboard?.classList.add('hidden');
        updateSidebarActiveStates(false);
        loadRequests();
    } else {
        // Dashboardga qaytish
        mainContent?.classList.add('hidden');
        superAdminDashboard?.classList.remove('hidden');
        updateSidebarActiveStates(true);
        loadSuperAdminStats();
    }
    showingDashboard = !showingDashboard;
};

function updateSidebarActiveStates(isDashboardActive) {
    const statsBtns = [document.getElementById('sidebar-stats-btn'), document.getElementById('mobile-stats-btn')];
    const murojaatBtns = [document.getElementById('sidebar-murojaatlar-btn'), document.getElementById('mobile-murojaatlar-btn')];

    if (isDashboardActive) {
        statsBtns.forEach(btn => btn?.classList.add('neu-active', 'text-primary'));
        murojaatBtns.forEach(btn => btn?.classList.remove('neu-active', 'text-primary'));
    } else {
        murojaatBtns.forEach(btn => btn?.classList.add('neu-active', 'text-primary'));
        statsBtns.forEach(btn => btn?.classList.remove('neu-active', 'text-primary'));
    }
}

async function loadSuperAdminStats() {
    try {
        // Barcha murojaatlarni olish
        const { data: allRequests, error } = await supabase
            .from('murojaatlar')
            .select('*, profiles(full_name, phone)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const requests = allRequests || [];

        // Save for modals
        allRequestsData = requests;

        // Statistika hisoblash
        const stats = {
            total: requests.length,
            pending: requests.filter(r => r.status === 'pending').length,
            progress: requests.filter(r => r.status === 'progress').length,
            done: requests.filter(r => r.status === 'done').length,
            rejected: requests.filter(r => r.status === 'rejected').length
        };

        // Statistika kartlarini yangilash
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-pending').textContent = stats.pending;
        document.getElementById('stat-progress').textContent = stats.progress;
        document.getElementById('stat-done').textContent = stats.done;
        document.getElementById('stat-rejected').textContent = stats.rejected;

        // Xodimlar statistikasi
        renderStaffStats(requests);

        // So'nggi murojaatlar jadvali
        renderRecentRequestsTable(requests.slice(0, 10));

    } catch (err) {
        console.error('Stats error:', err);
    }
}

function renderStaffStats(requests) {
    const container = document.getElementById('staff-stats-container');
    if (!container) return;

    // Rollar bo'yicha guruhlash
    const roleStats = {};

    for (const role of Object.keys(ROLE_NAMES)) {
        if (role === 'super_admin') continue;

        const roleRequests = requests.filter(r => r.target_role === role);
        roleStats[role] = {
            total: roleRequests.length,
            pending: roleRequests.filter(r => r.status === 'pending').length,
            progress: roleRequests.filter(r => r.status === 'progress').length,
            done: roleRequests.filter(r => r.status === 'done').length,
            rejected: roleRequests.filter(r => r.status === 'rejected').length
        };
    }

    // Render
    container.innerHTML = Object.entries(roleStats)
        .filter(([_, stats]) => stats.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([role, stats]) => {
            const donePercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            return `
                <div class="flex items-center gap-4 p-4 rounded-xl neu-inset cursor-pointer hover:scale-[1.01] transition-transform"
                     onclick="window.openStaffModal('${role}')">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-semibold text-slate-700">${ROLE_NAMES[role]}</span>
                            <span class="text-sm text-slate-500">${stats.done}/${stats.total} hal qilindi</span>
                        </div>
                        <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all" 
                                 style="width: ${donePercent}%"></div>
                        </div>
                        <div class="flex gap-3 mt-2 text-xs">
                            <span class="text-amber-600">⏳ ${stats.pending}</span>
                            <span class="text-blue-600">🔄 ${stats.progress}</span>
                            <span class="text-green-600">✅ ${stats.done}</span>
                            <span class="text-red-600">❌ ${stats.rejected}</span>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-slate-400">chevron_right</span>
                </div>
            `;
        }).join('') || '<p class="text-center text-slate-400 py-4">Hali murojaatlar yo\'q</p>';
}

// Store all requests for modal
let allRequestsData = [];

window.openStaffModal = async (role) => {
    const modal = document.getElementById('staff-detail-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Set header info
    document.getElementById('staff-modal-title').textContent = ROLE_NAMES[role] || role;
    document.getElementById('staff-modal-subtitle').textContent = '7-lik a\'zosi';
    document.getElementById('staff-modal-avatar').textContent = (ROLE_NAMES[role] || role).charAt(0).toUpperCase();

    // Filter requests for this role
    const roleRequests = allRequestsData.filter(r => r.target_role === role);

    const stats = {
        total: roleRequests.length,
        pending: roleRequests.filter(r => r.status === 'pending').length,
        progress: roleRequests.filter(r => r.status === 'progress').length,
        done: roleRequests.filter(r => r.status === 'done').length,
        rejected: roleRequests.filter(r => r.status === 'rejected').length
    };

    // Update stats
    document.getElementById('staff-stat-total').textContent = stats.total;
    document.getElementById('staff-stat-pending').textContent = stats.pending;
    document.getElementById('staff-stat-done').textContent = stats.done;
    document.getElementById('staff-stat-rejected').textContent = stats.rejected;

    // Animate progress ring
    const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    const ring = document.getElementById('staff-progress-ring');
    const percentText = document.getElementById('staff-percent');

    if (ring) {
        const circumference = 251.2; // 2 * π * 40
        const offset = circumference - (percent / 100) * circumference;
        ring.style.strokeDashoffset = offset;
    }
    if (percentText) percentText.textContent = percent + '%';

    // Render requests list
    const listContainer = document.getElementById('staff-requests-list');
    if (listContainer) {
        if (roleRequests.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-slate-400 py-8">Murojaatlar yo\'q</p>';
        } else {
            listContainer.innerHTML = roleRequests.map((req, index) => {
                const statusIcons = {
                    'pending': '⏳',
                    'progress': '🔄',
                    'done': '✅',
                    'rejected': '❌'
                };
                const statusColors = {
                    'pending': 'text-amber-500',
                    'progress': 'text-blue-500',
                    'done': 'text-black',
                    'rejected': 'text-red-500'
                };
                return `
                    <div class="group neu-card rounded-xl p-3 mb-2 flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-all"
                         onclick="window.closeStaffModal(); window.openRequestDetailModal('${req.id}')"
                         style="animation: particleFadeIn 0.25s ease-out ${index * 0.05}s both">
                        <div class="w-8 h-8 rounded-lg neu-inset flex items-center justify-center">
                            <span class="text-sm ${statusColors[req.status]}">${statusIcons[req.status] || '📋'}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-slate-700 truncate group-hover:text-primary transition-colors">${req.title || 'Nomsiz'}</p>
                            <p class="text-[11px] text-slate-500">${req.profiles?.full_name || 'Noma\'lum'} • ${new Date(req.created_at).toLocaleDateString('uz-UZ')}</p>
                        </div>
                        <span class="material-symbols-outlined text-slate-300 text-base group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                `;
            }).join('');
        }
    }
};

window.closeStaffModal = () => {
    document.getElementById('staff-detail-modal')?.classList.add('hidden');
};

// --- REQUEST DETAIL MODAL (Read Only for Super Admin) ---

window.openRequestDetailModal = async (requestId) => {
    const modal = document.getElementById('request-detail-modal');
    if (!modal) {
        console.error('Modal not found');
        return;
    }

    // Show modal immediately with loading state
    modal.classList.remove('hidden');

    // Set loading state
    document.getElementById('detail-modal-title').textContent = 'Yuklanmoqda...';
    document.getElementById('detail-chat-history').innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Yuklanmoqda...</p>';

    try {
        // Try to find in cache first, otherwise fetch
        let request = allRequestsData.find(r => r.id === requestId);

        if (!request) {
            // Fetch directly from Supabase
            const { data, error } = await supabase
                .from('murojaatlar')
                .select('*, profiles(full_name, phone)')
                .eq('id', requestId)
                .single();

            if (error) throw error;
            request = data;
        }

        if (!request) {
            throw new Error('Murojaat topilmadi');
        }

        // Set title
        document.getElementById('detail-modal-title').textContent = request.title || 'Nomsiz';

        // Set status badge
        const statusEl = document.getElementById('detail-modal-status');
        const statusStyles = {
            'pending': 'bg-amber-500',
            'progress': 'bg-blue-500',
            'done': 'bg-green-500',
            'rejected': 'bg-red-500'
        };
        const statusLabels = {
            'pending': 'Kutilmoqda',
            'progress': 'Jarayonda',
            'done': 'Bajarildi',
            'rejected': 'Rad etildi'
        };
        statusEl.className = `px-3 py-1 rounded-full text-xs font-semibold text-white ${statusStyles[request.status] || 'bg-gray-500'}`;
        statusEl.textContent = statusLabels[request.status] || request.status;

        // Image
        const imgContainer = document.getElementById('detail-image-container');
        const img = document.getElementById('detail-modal-image');
        if (request.image_url) {
            img.src = request.image_url;
            imgContainer.classList.remove('hidden');
        } else {
            imgContainer.classList.add('hidden');
        }

        // Info
        document.getElementById('detail-modal-sender').textContent = request.profiles?.full_name || 'Noma\'lum';
        document.getElementById('detail-modal-target').textContent = ROLE_NAMES[request.target_role] || request.target_role;
        document.getElementById('detail-modal-date').textContent = new Date(request.created_at).toLocaleString('uz-UZ');
        document.getElementById('detail-modal-location').textContent =
            (request.lat && request.lng) ? `${request.lat.toFixed(4)}, ${request.lng.toFixed(4)}` : 'Ko\'rsatilmagan';

        // Description
        document.getElementById('detail-modal-desc').textContent = request.description || 'Tavsif yo\'q';

        // Load chat history
        await loadChatHistoryReadOnly(requestId);

    } catch (err) {
        console.error('Error loading request:', err);
        document.getElementById('detail-modal-title').textContent = 'Xatolik';
        document.getElementById('detail-modal-desc').textContent = err.message;
    }
};

async function loadChatHistoryReadOnly(requestId) {
    const container = document.getElementById('detail-chat-history');
    if (!container) return;

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*, profiles(full_name, role)')
            .eq('murojaat_id', requestId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!messages || messages.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Xabarlar yo\'q</p>';
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isOfficial = msg.profiles?.role !== 'user';
            return `
                <div class="flex ${isOfficial ? 'justify-end' : 'justify-start'}">
                    <div class="${isOfficial ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-black'} px-3 py-2 rounded-xl max-w-[80%]">
                        <p class="text-xs font-semibold mb-1">${msg.profiles?.full_name || 'Noma\'lum'}</p>
                        <p class="text-sm">${msg.text}</p>
                        <p class="text-[10px] text-slate-400 mt-1">${new Date(msg.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Chat load error:', err);
        container.innerHTML = '<p class="text-center text-red-400 text-sm py-4">Xatolik yuz berdi</p>';
    }
}

window.closeRequestDetailModal = () => {
    document.getElementById('request-detail-modal')?.classList.add('hidden');
};

function renderRecentRequestsTable(requests) {
    const tbody = document.getElementById('recent-requests-table');
    if (!tbody) return;

    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400 py-4">Murojaatlar yo\'q</td></tr>';
        return;
    }

    const statusBadge = (status) => {
        const styles = {
            'pending': 'bg-amber-100 text-amber-600',
            'progress': 'bg-blue-100 text-blue-600',
            'done': 'bg-green-100 text-green-600',
            'rejected': 'bg-red-100 text-red-600'
        };
        const labels = {
            'pending': 'Kutilmoqda',
            'progress': 'Jarayonda',
            'done': 'Bajarildi',
            'rejected': 'Rad etildi'
        };
        return `<span class="px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100'}">${labels[status] || status}</span>`;
    };

    tbody.innerHTML = requests.map(req => `
        <tr class="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition" onclick="window.openRequestDetailModal('${req.id}')">
            <td class="py-3 font-medium text-slate-800">${req.title || 'Nomsiz'}</td>
            <td class="py-3 text-slate-600">${req.profiles?.full_name || 'Noma\'lum'}</td>
            <td class="py-3 text-slate-600">${ROLE_NAMES[req.target_role] || req.target_role}</td>
            <td class="py-3">${statusBadge(req.status)}</td>
            <td class="py-3 text-slate-500 text-xs">${new Date(req.created_at).toLocaleDateString('uz-UZ')}</td>
        </tr>
    `).join('');
}

// Init
checkAdmin();
