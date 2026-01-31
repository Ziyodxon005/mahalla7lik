import { supabase } from './supabase.js';

// Helper to sanitize phone
function sanitizePhone(phone) {
    return phone.replace(/\D/g, '');
}

export async function login(phone, password) {
    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone.length < 9) throw new Error("PHONE_INVALID");

    const email = `${cleanPhone}@mahalla.uz`;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.log('Login error:', error.status, error.message);
        // 400 = Invalid credentials (wrong password OR user doesn't exist)
        if (error.status === 400) {
            throw new Error("WRONG_PASSWORD");
        }
        throw new Error("LOGIN_ERROR");
    }
    return data;
}

export async function register(phone, password, fullName) {
    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone.length < 9) throw new Error("PHONE_INVALID");
    if (password.length < 6) throw new Error("PASSWORD_SHORT");
    if (!fullName || fullName.trim().length < 2) throw new Error("NAME_REQUIRED");

    const email = `${cleanPhone}@mahalla.uz`;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                phone: cleanPhone
            }
        }
    });

    if (error) {
        console.log('Register error:', error.status, error.message);
        if (error.status === 422 || error.message.includes('already registered')) {
            throw new Error("ALREADY_REGISTERED");
        }
        throw new Error("REGISTER_ERROR");
    }

    // Check if user already exists (Supabase returns user but with no session)
    if (data.user && !data.session) {
        throw new Error("ALREADY_REGISTERED");
    }

    // Create Profile
    if (data.user) {
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();

        if (!existingProfile) {
            await supabase.from('profiles').insert([{
                id: data.user.id,
                full_name: fullName,
                phone: cleanPhone,
                role: 'user'
            }]);
        }
    }

    return data;
}

export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return { ...user, profile };
}
