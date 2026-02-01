import '../styles/main.css';
import { supabase } from './supabase.js';
import { initMap } from './map.js';
import { uploadToTelegraph } from './upload.js';
import { login, register, logout } from './auth.js';
import { showToast } from './utils.js';

// DOM Elements
const authContainer = document.getElementById('auth-container');
const mainInterface = document.getElementById('main-interface');
const authForm = document.getElementById('auth-form');
const fullNameInput = document.getElementById('full-name');
const submitBtn = document.getElementById('submit-btn');
const toggleAuth = document.getElementById('toggle-auth');

// Request Form Elements
const requestForm = document.getElementById('request-form');
const reqImageInput = document.getElementById('req-image');
const dropZone = document.getElementById('drop-zone');
const imagePreview = document.getElementById('image-preview');
const requestsList = document.getElementById('requests-list');
const reqLatInput = document.getElementById('req-lat');
const reqLngInput = document.getElementById('req-lng');

// Chat Modal Elements
const chatModal = document.getElementById('chat-modal');
const userChatMessages = document.getElementById('user-chat-messages');
const userChatForm = document.getElementById('user-chat-form');
const userChatInput = document.getElementById('user-chat-input');
const userSendBtn = document.getElementById('user-send-btn');
const chatWithName = document.getElementById('chat-with-name');

// Loading Modal
const loadingModal = document.getElementById('loading-modal');
const loadingText = document.getElementById('loading-text');

// All Requests Modal
const allRequestsModal = document.getElementById('all-requests-modal');
const allRequestsList = document.getElementById('all-requests-list');

// State
let isRegistering = false;
let currentUser = null;
let uploadedImageUrl = null;
let mapInstance = null;
let activeChatId = null;
let activeChatTargetRole = null;
let chatChannel = null;
let unreadCounts = {};

// --- Loading Modal ---
function showLoading(text = 'Yuklanmoqda...') {
    if (loadingText) loadingText.textContent = text;
    loadingModal?.classList.remove('hidden');
}

function hideLoading() {
    loadingModal?.classList.add('hidden');
}

// --- Close all open dialogs ---
function closeAllDialogs() {
    chatModal?.classList.add('hidden');
    allRequestsModal?.classList.add('hidden');
    document.getElementById('role-modal')?.classList.add('hidden');
    document.getElementById('location-permission-dialog')?.remove();
    document.getElementById('rejection-reason-modal')?.remove();
}

// --- Auth Logic ---
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        const nameDisplay = document.getElementById('user-name-display');
        const avatarEl = document.getElementById('user-avatar-initial');

        let displayName = 'Foydalanuvchi';
        if (user.user_metadata?.full_name) {
            displayName = user.user_metadata.full_name;
        } else {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            if (profile?.full_name) displayName = profile.full_name;
        }

        if (nameDisplay) nameDisplay.textContent = displayName;
        if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

        showMainInterface();
    } else {
        showAuth();
    }
}

function showAuth() {
    authContainer.classList.remove('hidden');
    mainInterface.classList.add('hidden');
    // Start audio and visualization when auth screen is shown
    if (typeof window.initAudioVisualization === 'function') {
        window.initAudioVisualization();
    }
}

function showMainInterface() {
    authContainer.classList.add('hidden');
    mainInterface.classList.remove('hidden');
    loadMyRequests();

    if (!mapInstance) {
        setTimeout(() => {
            mapInstance = initMap('map', (lat, lng) => {
                reqLatInput.value = lat;
                reqLngInput.value = lng;
            });
        }, 100);
    }
}

toggleAuth?.addEventListener('click', () => {
    isRegistering = !isRegistering;
    if (isRegistering) {
        submitBtn.textContent = "Ro'yxatdan o'tish";
        fullNameInput.classList.remove('hidden');
        fullNameInput.required = true;
        toggleAuth.textContent = "Kirish";
    } else {
        submitBtn.textContent = "Kirish";
        fullNameInput.classList.add('hidden');
        fullNameInput.required = false;
        toggleAuth.textContent = "Ro'yxatdan o'tish";
    }
});

authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const fullName = fullNameInput.value;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Yuklanmoqda...";

        if (isRegistering) {
            const { user } = await register(phone, password, fullName);
            if (user) {
                showToast("Muvaffaqiyatli ro'yxatdan o'tdingiz!", 'success');
                currentUser = user;
                showMainInterface();
            }
        } else {
            const { user } = await login(phone, password);
            if (user) {
                currentUser = user;
                showMainInterface();
            }
        }
    } catch (error) {
        handleAuthError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isRegistering ? "Ro'yxatdan o'tish" : "Kirish";
    }
});

// Handle all auth errors with nice dialogs
function handleAuthError(errorCode) {
    switch (errorCode) {
        case "ALREADY_REGISTERED":
            showAuthDialog({
                icon: 'person',
                iconBg: 'bg-blue-100',
                iconColor: 'text-black',
                title: "Siz avval ro'yxatdan o'tgansiz!",
                message: "Bu telefon raqam allaqachon tizimda mavjud. Iltimos, parolingiz bilan kiring.",
                buttonText: "Kirish sahifasiga o'tish",
                action: () => switchToLogin()
            });
            break;

        case "WRONG_PASSWORD":
            showAuthDialog({
                icon: 'lock',
                iconBg: 'bg-red-100',
                iconColor: 'text-red-500',
                title: "Parol noto'g'ri!",
                message: "Kiritgan parolingiz xato. Qaytadan urinib ko'ring yoki ro'yxatdan o'ting.",
                buttonText: "Tushundim",
                action: null,
                showRegisterBtn: true
            });
            break;

        case "PHONE_INVALID":
            showToast("Telefon raqam noto'g'ri (kamida 9 ta raqam)", 'error');
            break;

        case "PASSWORD_SHORT":
            showToast("Parol kamida 6 ta belgidan iborat bo'lishi kerak", 'error');
            break;

        case "NAME_REQUIRED":
            showToast("Ism familiyani kiriting", 'error');
            break;

        default:
            showToast("Xatolik yuz berdi. Qaytadan urinib ko'ring.", 'error');
    }
}

// Reusable auth dialog
function showAuthDialog({ icon, iconBg, iconColor, title, message, buttonText, action, showRegisterBtn = false }) {
    const existing = document.getElementById('auth-error-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'auth-error-dialog';
    dialog.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm modal-backdrop';

    let buttonsHtml = `<button id="auth-dialog-primary-btn" class="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition shadow-lg">${buttonText}</button>`;

    if (showRegisterBtn) {
        buttonsHtml = `
            <button id="auth-dialog-close-btn" class="flex-1 py-3 bg-slate-200 text-black font-bold rounded-xl hover:bg-slate-300 transition">Yopish</button>
            <button id="auth-dialog-register-btn" class="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition shadow-lg">Ro'yxatdan o'tish</button>
        `;
    }

    dialog.innerHTML = `
        <div style="background: #e0e5ec; box-shadow: 6px 6px 12px #b8bec7, -6px -6px 12px #ffffff;" class="p-6 rounded-3xl text-center max-w-sm mx-4 modal-content">
            <div class="w-14 h-14 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined ${iconColor} text-3xl">${icon}</span>
            </div>
            <h3 class="text-lg font-bold text-black mb-2">${title}</h3>
            <p class="text-black text-sm mb-6">${message}</p>
            <div class="flex gap-3">
                ${buttonsHtml}
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // Primary button
    const primaryBtn = document.getElementById('auth-dialog-primary-btn');
    if (primaryBtn) {
        primaryBtn.onclick = () => {
            dialog.remove();
            if (action) action();
        };
    }

    // Close button
    const closeBtn = document.getElementById('auth-dialog-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => dialog.remove();
    }

    // Register button
    const registerBtn = document.getElementById('auth-dialog-register-btn');
    if (registerBtn) {
        registerBtn.onclick = () => {
            dialog.remove();
            switchToRegister();
        };
    }
}

function switchToLogin() {
    isRegistering = false;
    submitBtn.textContent = "Kirish";
    fullNameInput.classList.add('hidden');
    fullNameInput.required = false;
    toggleAuth.textContent = "Ro'yxatdan o'tish";
    showToast("Endi parolingizni kiritib kiring", 'info');
}

function switchToRegister() {
    isRegistering = true;
    submitBtn.textContent = "Ro'yxatdan o'tish";
    fullNameInput.classList.remove('hidden');
    fullNameInput.required = true;
    toggleAuth.textContent = "Kirish";
    showToast("Ism va parol kiritib ro'yxatdan o'ting", 'info');
}

// --- Image Upload with Loading ---
dropZone?.addEventListener('click', () => reqImageInput.click());

reqImageInput?.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
            showLoading('Rasm yuklanmoqda...');
            const url = await uploadToTelegraph(file);
            uploadedImageUrl = url;
            imagePreview.src = url;
            imagePreview.classList.remove('hidden');
            showToast("Rasm yuklandi", 'success');
        } catch (err) {
            showToast("Rasm yuklashda xatolik", 'error');
        } finally {
            hideLoading();
        }
    }
});

// --- Request Submission ---
requestForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('req-title')?.value.trim();
    const desc = document.getElementById('req-desc')?.value.trim();
    const targetRole = document.getElementById('req-target-role')?.value;

    if (!title) {
        showToast("Murojaat mavzusini kiriting!", 'error');
        return;
    }
    if (!desc) {
        showToast("Tavsifni yozing!", 'error');
        return;
    }
    if (!targetRole) {
        showToast("Kimga murojaat qilishni tanlang!", 'error');
        if (window.openRoleModal) window.openRoleModal();
        return;
    }

    // Check location
    if (!reqLatInput.value || !reqLngInput.value) {
        showLocationRequiredToast();
        return;
    }

    const requestData = {
        user_id: currentUser.id,
        target_role: targetRole,
        title: title,
        description: desc,
        lat: parseFloat(reqLatInput.value),
        lng: parseFloat(reqLngInput.value),
        image_url: uploadedImageUrl,
        status: 'pending'
    };

    try {
        showLoading('Murojaat yuborilmoqda...');
        const { error } = await supabase.from('murojaatlar').insert([requestData]);
        if (error) throw error;

        hideLoading();
        showSuccessDialog();

    } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
    }
});

function showLocationRequiredToast() {
    // Create a special toast for location
    const existing = document.getElementById('location-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'location-toast';
    toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-amber-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce';
    toast.innerHTML = `
        <span class="material-symbols-outlined">location_off</span>
        <div>
            <p class="font-bold">Joylashuv kerak!</p>
            <p class="text-xs opacity-90">Xaritadan joylashuvni belgilang yoki "📍 Joylashuvni Aniqlash" tugmasini bosing</p>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
}

function showSuccessDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm';
    dialog.innerHTML = `
        <div style="background: #e0e5ec; box-shadow: 6px 6px 12px #b8bec7, -6px -6px 12px #ffffff;" class="p-8 rounded-3xl text-center max-w-sm mx-4">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-green-500 text-4xl">check_circle</span>
            </div>
            <h3 class="text-xl font-bold text-black mb-2">Murojaat Yuborildi!</h3>
            <p class="text-black text-sm mb-6">Sizning murojaatingiz muvaffaqiyatli qabul qilindi.</p>
            <button onclick="window.location.reload()" class="w-full py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 shadow-lg">Davom etish</button>
        </div>
    `;
    document.body.appendChild(dialog);
}

// --- Timeline List ---
async function loadMyRequests() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('murojaatlar')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error || !data) {
        requestsList.innerHTML = '<p class="text-sm text-black text-center">Murojaatlar topilmadi</p>';
        return;
    }

    // Check for unread messages
    await checkUnreadMessages(data.map(r => r.id));

    renderRequestsList(data, requestsList);
}

async function checkUnreadMessages(requestIds) {
    for (const id of requestIds) {
        // Count messages NOT from current user (received messages)
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('murojaat_id', id)
            .neq('sender_id', currentUser.id);

        unreadCounts[id] = count || 0;
    }
}

function renderRequestsList(data, container) {
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<p class="text-sm text-black text-center py-10">Hali murojaat yo\'q</p>';
        return;
    }

    data.forEach(req => {
        const div = document.createElement('div');
        div.className = 'neu-inset rounded-xl p-4 cursor-pointer hover:ring-2 hover:ring-primary/30 transition relative';
        div.onclick = () => openUserChat(req.id, req.target_role, req.title, req.status);

        const statusBadge = {
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

        const hasUnread = unreadCounts[req.id] > 0;

        div.innerHTML = `
            ${hasUnread ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>' : ''}
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold text-black">#${req.id.slice(0, 6)}</span>
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge}">${statusText}</span>
            </div>
            <h4 class="font-bold text-black text-sm mb-1 truncate">${req.title}</h4>
            <p class="text-xs text-black line-clamp-1">${req.description}</p>
            <div class="flex justify-between items-center mt-2 pt-2 border-t border-white/30">
                <span class="text-[10px] text-black">${new Date(req.created_at).toLocaleDateString()}</span>
                <span class="text-xs text-primary font-bold flex items-center gap-1">
                    Chat <span class="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- All Requests Modal ---
window.openAllRequestsModal = async () => {
    closeAllDialogs();
    allRequestsModal?.classList.remove('hidden');

    const { data } = await supabase
        .from('murojaatlar')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (data) {
        await checkUnreadMessages(data.map(r => r.id));
        renderRequestsList(data, allRequestsList);
    }
};

// --- Show Rejection Reason ---
async function showRejectionReason(requestId, title, targetRole) {
    // Fetch the rejection message (message starting with "RAD ETILDI:")
    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('murojaat_id', requestId)
        .order('created_at', { ascending: false });

    let rejectionReason = "Sabab ko'rsatilmagan";
    if (messages && messages.length > 0) {
        const rejectionMsg = messages.find(m => m.text.startsWith('RAD ETILDI:'));
        if (rejectionMsg) {
            rejectionReason = rejectionMsg.text.replace('RAD ETILDI:', '').trim();
        }
    }

    const roleName = {
        'rais': 'Mahalla Raisi',
        'hokim_yordamchisi': 'Hokim Yordamchisi',
        'yoshlar_yetakchisi': 'Yoshlar Yetakchisi',
        'ayollar_faoli': 'Ayollar Faoli',
        'inspektor': 'Profilaktika Inspektori',
        'ijtimoiy_xodim': 'Ijtimoiy Xodim'
    }[targetRole] || 'Admin';

    const modal = document.createElement('div');
    modal.id = 'rejection-reason-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm';
    modal.innerHTML = `
        <div style="background: #e0e5ec; box-shadow: 6px 6px 12px #b8bec7, -6px -6px 12px #ffffff;" class="p-6 rounded-3xl max-w-md mx-4">
            <div class="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-red-500 text-3xl">cancel</span>
            </div>
            <h3 class="text-lg font-bold text-black mb-1 text-center">Murojaat Rad Etildi</h3>
            <p class="text-xs text-black text-center mb-4">${title}</p>
            
            <div class="bg-red-50 rounded-xl p-4 mb-4">
                <p class="text-xs text-red-400 font-bold mb-1">${roleName} tomonidan rad etildi:</p>
                <p class="text-sm text-red-600">${rejectionReason}</p>
            </div>
            
            <div class="flex gap-3">
                <button onclick="document.getElementById('rejection-reason-modal').remove()" class="flex-1 py-3 bg-slate-200 text-black font-bold rounded-xl hover:bg-slate-300 transition text-sm">Yopish</button>
                <button onclick="document.getElementById('rejection-reason-modal').remove(); openChatAfterRejection('${requestId}', '${targetRole}', '${title.replace(/'/g, "\\'")}')" class="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition shadow-lg text-sm">Yozish</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Open chat after viewing rejection
window.openChatAfterRejection = async (requestId, targetRole, title) => {
    activeChatId = requestId;
    activeChatTargetRole = targetRole;

    chatModal?.classList.remove('hidden');
    userChatMessages.innerHTML = '<p class="text-center text-black text-sm py-4">Yuklanmoqda...</p>';

    const roleName = {
        'rais': 'Mahalla Raisi',
        'hokim_yordamchisi': 'Hokim Yordamchisi',
        'yoshlar_yetakchisi': 'Yoshlar Yetakchisi',
        'ayollar_faoli': 'Ayollar Faoli',
        'inspektor': 'Profilaktika Inspektori',
        'ijtimoiy_xodim': 'Ijtimoiy Xodim'
    }[targetRole] || 'Admin';

    if (chatWithName) {
        chatWithName.innerHTML = `${roleName} <span class="text-black font-normal">• ${title}</span>`;
    }

    // Load messages
    if (chatChannel) {
        await supabase.removeChannel(chatChannel);
        chatChannel = null;
    }

    try {
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('murojaat_id', requestId)
            .order('created_at', { ascending: true });

        userChatMessages.innerHTML = '';

        if (messages && messages.length > 0) {
            messages.forEach(msg => appendUserMessage(msg));
        } else {
            userChatMessages.innerHTML = '<p class="text-center text-black text-sm py-4">Hali xabar yo\'q</p>';
        }

        chatChannel = supabase.channel(`user-chat-realtime-${requestId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `murojaat_id=eq.${requestId}`
            }, (payload) => {
                if (payload.new.sender_id !== currentUser.id) {
                    const noMsg = userChatMessages.querySelector('p.text-center');
                    if (noMsg) noMsg.remove();
                    appendUserMessage(payload.new);
                }
            })
            .subscribe();
    } catch (err) {
        console.error('Chat error:', err);
    }
};

// --- User Chat (with optimistic updates) ---
async function openUserChat(requestId, targetRole, title, status) {
    // Close all other dialogs first
    closeAllDialogs();

    activeChatId = requestId;
    activeChatTargetRole = targetRole;

    // If rejected, first show rejection reason
    if (status === 'rejected') {
        await showRejectionReason(requestId, title, targetRole);
        return;
    }

    chatModal?.classList.remove('hidden');
    userChatMessages.innerHTML = '<p class="text-center text-black text-sm py-4">Yuklanmoqda...</p>';

    const roleName = {
        'rais': 'Mahalla Raisi',
        'hokim_yordamchisi': 'Hokim Yordamchisi',
        'yoshlar_yetakchisi': 'Yoshlar Yetakchisi',
        'ayollar_faoli': 'Ayollar Faoli',
        'inspektor': 'Profilaktika Inspektori',
        'ijtimoiy_xodim': 'Ijtimoiy Xodim'
    }[targetRole] || 'Admin';

    if (chatWithName) {
        chatWithName.innerHTML = `${roleName} <span class="text-black font-normal">• ${title}</span>`;
    }

    // Unsubscribe from previous
    if (chatChannel) {
        await supabase.removeChannel(chatChannel);
        chatChannel = null;
    }

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('murojaat_id', requestId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        userChatMessages.innerHTML = '';

        if (messages && messages.length > 0) {
            messages.forEach(msg => appendUserMessage(msg));
        } else {
            userChatMessages.innerHTML = '<p class="text-center text-black text-sm py-4">Hali xabar yo\'q. Birinchi yozing!</p>';
        }

        // Subscribe to realtime updates
        chatChannel = supabase.channel(`user-chat-realtime-${requestId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `murojaat_id=eq.${requestId}`
            }, (payload) => {
                console.log('Realtime message received:', payload);
                // Only append if not from current user (to avoid duplicates from optimistic update)
                if (payload.new.sender_id !== currentUser.id) {
                    const noMsg = userChatMessages.querySelector('p.text-center');
                    if (noMsg) noMsg.remove();
                    appendUserMessage(payload.new);
                }
            })
            .subscribe((status) => {
                console.log('Subscription status:', status);
            });

    } catch (err) {
        console.error('Chat error:', err);
        userChatMessages.innerHTML = '<p class="text-center text-red-400 text-sm py-4">Xatolik</p>';
    }
}

function appendUserMessage(msg, isOptimistic = false) {
    if (!userChatMessages || !currentUser) return;

    const isMe = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Remove "no messages" text
    const noMsg = userChatMessages.querySelector('p.text-center');
    if (noMsg) noMsg.remove();

    const div = document.createElement('div');
    div.id = `msg-${msg.id || 'temp-' + Date.now()}`;

    if (isMe) {
        div.className = 'flex flex-col items-end gap-1 max-w-[85%] ml-auto';
        // Single check for sent, will be updated when confirmed
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
        div.className = 'flex flex-col items-start gap-1 max-w-[85%]';
        div.innerHTML = `
            <div class="neu-inset rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-black">
                ${msg.text}
            </div>
            <span class="text-[10px] text-black ml-1">${time}</span>
        `;
    }
    userChatMessages.appendChild(div);
    userChatMessages.scrollTop = userChatMessages.scrollHeight;
}

// Send message with optimistic update
userChatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeChatId || !userChatInput?.value.trim()) return;

    const text = userChatInput.value.trim();
    userChatInput.value = '';

    // Create temporary message for optimistic update
    const tempMsg = {
        id: 'temp-' + Date.now(),
        murojaat_id: activeChatId,
        sender_id: currentUser.id,
        text: text,
        created_at: new Date().toISOString()
    };

    // Show message immediately (optimistic)
    appendUserMessage(tempMsg, true);

    // Show sending state on button
    userSendBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';
    userSendBtn.disabled = true;

    try {
        const { data, error } = await supabase.from('messages').insert([{
            murojaat_id: activeChatId,
            sender_id: currentUser.id,
            text: text
        }]).select().single();

        if (error) {
            // Remove optimistic message on error
            document.getElementById(`msg-${tempMsg.id}`)?.remove();
            showToast("Xabar yuborilmadi", 'error');
        } else {
            // Update the temp message to show double check
            const tempCheck = document.getElementById(`check-temp`);
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
        userSendBtn.innerHTML = '<span class="material-symbols-outlined text-lg">send</span>';
        userSendBtn.disabled = false;
    }
});

// Expose for button
window.loadMyRequests = loadMyRequests;

// Init
checkUser();
