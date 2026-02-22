import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User } from '../../types';

export interface LoginResult {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
}

export interface RegisterResult {
    success: boolean;
    error?: string;
}

const usernameToEmail = (username: string): string => {
    return `${username.toLowerCase().trim()}@sunmart.local`;
};

export const AuthService = {
    async login(username: string, password: string): Promise<LoginResult> {
        if (!username || !password) {
            return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
        }

        if (username.length < 3 || password.length < 4) {
            return { success: false, error: 'Thông tin đăng nhập không hợp lệ' };
        }

        if (isSupabaseConfigured()) {
            try {
                const email = usernameToEmail(username);
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (authError || !authData.user) {
                    console.error('[Auth] Supabase Auth error:', authError?.message);
                    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
                }

                const { data: userProfile, error: profileError } = await supabase
                    .from('users')
                    .select('id, username, name, role, store_id, xp, level, avatar_url')
                    .eq('id', authData.user.id)
                    .single();

                if (profileError || !userProfile) {
                    console.error('[Auth] Profile fetch error:', profileError?.message);
                    const meta = authData.user.user_metadata;
                    const mappedUser: User = {
                        id: authData.user.id,
                        name: meta?.name || username,
                        username: meta?.username || username,
                        role: meta?.role || 'EMPLOYEE',
                        store: '',
                        xp: 0,
                        level: 1,
                        avatar: '',
                        avatarUrl: '',
                    };
                    return {
                        success: true,
                        user: mappedUser,
                        token: authData.session?.access_token,
                    };
                }

                const { data: store } = userProfile.store_id
                    ? await supabase.from('stores').select('code, name').eq('id', userProfile.store_id).single()
                    : { data: null };

                const mappedUser: User = {
                    id: userProfile.id,
                    name: userProfile.name,
                    username: userProfile.username,
                    role: userProfile.role || 'EMPLOYEE',
                    store: store?.code || '',
                    xp: userProfile.xp || 0,
                    level: userProfile.level || 1,
                    avatar: userProfile.avatar_url || '',
                    avatarUrl: userProfile.avatar_url || '',
                };
                return {
                    success: true,
                    user: mappedUser,
                    token: authData.session?.access_token,
                };

            } catch (e) {
                console.error('[Auth] Login error:', e);
                return { success: false, error: 'Lỗi kết nối server' };
            }
        }

        await new Promise(r => setTimeout(r, 500));

        return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    },

    async register(
        username: string,
        password: string,
        name: string,
        employeeId: string,
        storeCode: string
    ): Promise<RegisterResult> {
        if (!username || !password || !name || !employeeId || !storeCode) {
            return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
        }

        if (username.length < 3) {
            return { success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' };
        }

        if (password.length < 6) {
            return { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { data: store, error: storeError } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (storeError || !store) {
                    return { success: false, error: 'Mã cửa hàng không hợp lệ' };
                }

                const email = usernameToEmail(username);
                const { data: authData, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username.toLowerCase().trim(),
                            name: name.trim(),
                            role: 'EMPLOYEE',
                            employee_id: employeeId,
                        },
                    },
                });

                if (signUpError || !authData.user) {
                    console.error('[Auth] SignUp error:', signUpError?.message);
                    if (signUpError?.message?.includes('already')) {
                        return { success: false, error: 'Tên đăng nhập đã tồn tại' };
                    }
                    return { success: false, error: 'Lỗi tạo tài khoản' };
                }

                const { error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        id: authData.user.id,
                        username: username.toLowerCase().trim(),
                        password_hash: 'managed_by_supabase_auth',
                        name: name.trim(),
                        employee_id: employeeId,
                        store_id: store.id,
                        role: 'EMPLOYEE',
                        xp: 0,
                        level: 1,
                    }]);

                if (insertError) {
                    console.error('[Auth] Insert public.users error:', insertError);
                    return { success: false, error: 'Lỗi tạo hồ sơ người dùng' };
                }

                return { success: true };

            } catch (e) {
                console.error('[Auth] Register error:', e);
                return { success: false, error: 'Lỗi kết nối server' };
            }
        }

        await new Promise(r => setTimeout(r, 500));
        return { success: true };
    },

    async logout(): Promise<{ success: boolean }> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[Auth] Logout error:', error.message);
            }
        }
        return { success: true };
    },

    isAuthenticated(): boolean {
        if (!isSupabaseConfigured()) return false;
        const url = import.meta.env.VITE_SUPABASE_URL || '';
        const projectRef = url ? new URL(url).hostname.split('.')[0] : '';
        const storageKey = `sb-${projectRef}-auth-token`;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return false;
            const session = JSON.parse(raw);
            return !!session?.access_token;
        } catch {
            return false;
        }
    },

    async getSession() {
        if (!isSupabaseConfigured()) return null;
        const { data } = await supabase.auth.getSession();
        return data.session;
    },

    async changePassword(
        _userId: string,
        _currentPassword: string,
        newPassword: string
    ): Promise<{ success: boolean; error?: string }> {
        if (newPassword.length < 6) {
            return { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' };
        }

        if (isSupabaseConfigured()) {
            try {
                const { error } = await supabase.auth.updateUser({
                    password: newPassword,
                });

                if (error) {
                    console.error('[Auth] Change password error:', error.message);
                    return { success: false, error: 'Lỗi cập nhật mật khẩu' };
                }

                return { success: true };
            } catch (e) {
                console.error('[Auth] Change password error:', e);
                return { success: false, error: 'Lỗi cập nhật mật khẩu' };
            }
        }

        return { success: true };
    },
};

export default AuthService;
