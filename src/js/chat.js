import { supabase } from './supabase.js';

let currentChatId = null;
let chatUser = null;

// Create Chat UI elements dynamically if they don't exist
function ensureChatModal() {
    if (document.getElementById('chat-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'chat-modal';
    modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50';
    modal.innerHTML = `
        <div class="neu-box w-full max-w-md h-[500px] flex flex-col p-4 bg-gray-100">
            <div class="flex justify-between items-center mb-4 border-b pb-2">
                <h3 class="font-bold">Yozishmalar</h3>
                <button id="close-chat" class="text-xl font-bold">&times;</button>
            </div>
            <div id="chat-messages" class="flex-1 overflow-y-auto mb-4 p-2 flex flex-col gap-2">
                <!-- Messages -->
            </div>
            <form id="chat-form" class="flex gap-2">
                <input type="text" id="chat-input" placeholder="Xabar yozing..." class="neu-input mb-0 flex-1" required autocomplete="off">
                <button type="submit" class="neu-btn px-4">></button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // Events
    document.getElementById('close-chat').addEventListener('click', closeChat);
    document.getElementById('chat-form').addEventListener('submit', sendMessage);
}

export function openChat(murojaatId, user) {
    ensureChatModal();
    currentChatId = murojaatId;
    chatUser = user;

    document.getElementById('chat-modal').classList.remove('hidden');
    document.getElementById('chat-messages').innerHTML = '<p class="text-center text-gray-500">Yuklanmoqda...</p>';

    fetchMessages();
    subscribeToMessages();
}

function closeChat() {
    document.getElementById('chat-modal').classList.add('hidden');
    currentChatId = null;
    // Unsubscribe if needed (Supabase realtime handles cleanup usually, but explicit unsubscribe is better if scaling)
}

async function fetchMessages() {
    if (!currentChatId) return;

    const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(full_name)')
        .eq('murojaat_id', currentChatId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Chat error:", error);
        return;
    }

    renderMessages(data);
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    messages.forEach(msg => {
        const isMe = msg.sender_id === chatUser.id;
        const div = document.createElement('div');
        div.className = `max-w-[80%] p-2 rounded-lg text-sm ${isMe ? 'self-end bg-blue-500 text-white' : 'self-start bg-gray-300 text-black'}`;
        div.innerHTML = `
            <div class="font-bold text-xs opacity-75 mb-1">${isMe ? 'Siz' : (msg.profiles?.full_name || 'Foydalanuvchi')}</div>
            <div>${msg.text}</div>
            <div class="text-[10px] opacity-75 text-right mt-1">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentChatId) return;

    const { error } = await supabase
        .from('messages')
        .insert([{
            murojaat_id: currentChatId,
            sender_id: chatUser.id,
            text: text
        }]);

    if (error) {
        alert("Xabar yuborishda xatolik");
        console.error(error);
    } else {
        input.value = '';
        fetchMessages(); // Or rely on realtime
    }
}

function subscribeToMessages() {
    // Basic polling or Realtime setup
    // For specific row changes:
    const channel = supabase
        .channel('chat-room')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `murojaat_id=eq.${currentChatId}` },
            (payload) => {
                fetchMessages();
            }
        )
        .subscribe();
}
