/**
 * Authentication Service
 * 
 * Uses Supabase Auth for authentication with JWT tokens.
 * This ensures RLS policies work correctly via auth.uid().
 * 
 * @security
 * - Supabase Auth manages password hashing (bcrypt)
 * - JWT tokens managed by Supabase with automatic refresh
 * - RLS policies enforce data access at database level
 * - Session managed via Supabase Auth cookie/localStorage
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User } from '../types';

// ===========================================================================
// TYPES
// ===========================================================================

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

// ===========================================================================
// MOCK DATA (Development only)
// ===========================================================================

const MOCK_USERS: User[] = [
    {
        id: '1',
        name: 'Admin User',
        username: 'admin',
        role: 'ADMIN',
        store: 'ALL',
        xp: 1250,
        level: 3,
        avatar: '',
        avatarUrl: ''
    },
    {
        id: '2',
        name: 'Nhân viên Demo',
        username: 'nhanvien',
        role: 'EMPLOYEE',
        store: 'CHN',
        xp: 350,
        level: 1,
        avatar: '',
        avatarUrl: ''
    },
];

// ===========================================================================
// HELPER: Convert username to email format for Supabase Auth
// ===========================================================================

const usernameToEmail = (username: string): string => {
    return `${username.toLowerCase().trim()}@sunmart.local`;
};

export const AuthService = {
    /**
     * Login using Supabase Auth signInWithPassword.
     * This creates a JWT session with role 'authenticated',
     * making auth.uid() available for RLS policies.
     */
    async login(username: string, password: string): Promise<LoginResult> {
        if (!username || !password) {
            return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
        }

        if (username.length < 3 || password.length < 4) {
            return { success: false, error: 'Thông tin đăng nhập không hợp lệ' };
        }

        if (isSupabaseConfigured()) {
            try {
                // Sign in via Supabase Auth → creates JWT session
                const email = usernameToEmail(username);
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (authError || !authData.user) {
                    console.error('[Auth] Supabase Auth error:', authError?.message);
                    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
                }

                // Now we are authenticated! auth.uid() works.
                // Fetch user profile from public.users (RLS will allow this)
                const { data: userProfile, error: profileError } = await supabase
                    .from('users')
                    .select('id, username, name, role, store_id, xp, level, avatar_url')
                    .eq('id', authData.user.id)
                    .single();

                if (profileError || !userProfile) {
                    console.error('[Auth] Profile fetch error:', profileError?.message);
                    // Auth succeeded but profile not found - still return basic info
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

                // Get store info (RLS allows this now since we're authenticated)
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

                console.log('[Auth] Login successful:', username, '| Role:', mappedUser.role);
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

        // Mock mode for development
        await new Promise(r => setTimeout(r, 500));

        const mockUser = MOCK_USERS.find(
            u => u.username.toLowerCase() === username.toLowerCase()
        );

        if (mockUser && password === '1234') {
            return { success: true, user: mockUser, token: 'mock-token' };
        }

        return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    },

    /**
     * Register a new user via Supabase Auth + public.users entry.
     */
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
                // Get store first (before auth signup)
                const { data: store, error: storeError } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('code', storeCode)
                    .single();

                if (storeError || !store) {
                    return { success: false, error: 'Mã cửa hàng không hợp lệ' };
                }

                // Create auth user via Supabase Auth
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

                // Create public.users entry with same ID
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

        // Mock mode
        await new Promise(r => setTimeout(r, 500));
        return { success: true };
    },

    /**
     * Logout - signs out from Supabase Auth, clearing JWT session.
     */
    async logout(): Promise<{ success: boolean }> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[Auth] Logout error:', error.message);
            }
        }
        console.log('[Auth] Logout — session cleared');
        return { success: true };
    },

    /**
     * Check if user has an active Supabase Auth session.
     */
    isAuthenticated(): boolean {
        // This is a sync check; for async check use getSession()
        // Supabase stores session in localStorage automatically
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

    /**
     * Get current Supabase Auth session (async).
     */
    async getSession() {
        if (!isSupabaseConfigured()) return null;
        const { data } = await supabase.auth.getSession();
        return data.session;
    },

    /**
     * Change password via Supabase Auth.
     */
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
