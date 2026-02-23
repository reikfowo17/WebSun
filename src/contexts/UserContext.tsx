import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "../types";
import { AuthService } from "../services/auth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

interface UserProviderProps {
  children: ReactNode;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check Supabase Auth session on mount + listen for auth state changes
  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        if (!isSupabaseConfigured()) {
          // Check sessionStorage for mock mode
          const savedUser = sessionStorage.getItem("sunmart_user");
          if (savedUser && isMounted) {
            setUser(JSON.parse(savedUser) as User);
          }
          return;
        }

        // Check existing Supabase Auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && isMounted) {
          // Fetch user profile from public.users
          const { data: userProfile } = await supabase
            .from("users")
            .select("id, username, name, role, store_id, xp, level, avatar_url")
            .eq("id", session.user.id)
            .single();

          if (userProfile && isMounted) {
            const { data: store } = userProfile.store_id
              ? await supabase
                  .from("stores")
                  .select("code, name")
                  .eq("id", userProfile.store_id)
                  .single()
              : { data: null };

            const mappedUser: User = {
              id: userProfile.id,
              name: userProfile.name,
              username: userProfile.username,
              role: userProfile.role || "EMPLOYEE",
              store: store?.code || "",
              xp: userProfile.xp || 0,
              level: userProfile.level || 1,
              avatar: userProfile.avatar_url || "",
              avatarUrl: userProfile.avatar_url || "",
            };
            setUser(mappedUser);
          }
        }
      } catch (error) {
        console.error("[UserContext] Session check failed:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initSession();

    // Listen for Supabase Auth state changes (login, logout, token refresh)
    let subscription: { unsubscribe: () => void } | null = null;

    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log("[UserContext] Auth state change:", event);

          if (event === "SIGNED_OUT" || !session) {
            if (isMounted) setUser(null);
          }
          // SIGNED_IN is handled by login() directly, not here
          // to avoid double-fetching
        },
      );
      subscription = data.subscription;
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await AuthService.login(username, password);

      if (result.success && result.user) {
        setUser(result.user);
        // Also store in sessionStorage as backup for page refresh
        sessionStorage.setItem("sunmart_user", JSON.stringify(result.user));
        return { success: true };
      }

      return { success: false, error: result.error || "Đăng nhập thất bại" };
    } catch (error) {
      console.error("[UserContext] Login error:", error);
      return { success: false, error: "Lỗi kết nối server" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error("[UserContext] Logout error:", error);
    } finally {
      setUser(null);
      sessionStorage.clear();
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      sessionStorage.setItem("sunmart_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value: UserContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const useCurrentUser = (): User | null => {
  const { user } = useUser();
  return user;
};

export const useIsAdmin = (): boolean => {
  const { user } = useUser();
  return user?.role === "ADMIN";
};

export default UserContext;
