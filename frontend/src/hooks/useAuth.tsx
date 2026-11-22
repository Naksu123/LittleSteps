"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ApiError,
  authApi,
  clearStoredTokens,
  getStoredTokens,
  onAuthExpired,
  setStoredTokens,
} from "@/services/api";
import type { Child, MeResponse, UserSummary } from "@/types";

interface AuthContextValue {
  user: UserSummary | null;
  childrenList: Child[];
  activeChildId: string | null;
  setActiveChildId: (childId: string | null) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserSummary>;
  staffLogin: (
    email: string,
    password: string,
    accessCode: string
  ) => Promise<UserSummary>;
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    privacy_consent_accepted: boolean;
  }) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACTIVE_CHILD_KEY = "littlesteps_active_child_id";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [activeChildId, setActiveChildIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setActiveChildId = useCallback((childId: string | null) => {
    setActiveChildIdState(childId);
    if (typeof window !== "undefined") {
      if (childId) {
        window.localStorage.setItem(ACTIVE_CHILD_KEY, childId);
      } else {
        window.localStorage.removeItem(ACTIVE_CHILD_KEY);
      }
    }
  }, []);

  const hydrateSessionChildren = useCallback(
    (me: MeResponse) => {
      setUser(me.user);
      setChildrenList(me.children);

      const savedId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ACTIVE_CHILD_KEY)
          : null;
      const validSaved = me.children.find((c) => c.id === savedId);
      if (validSaved) {
        setActiveChildIdState(validSaved.id);
      } else if (me.children.length > 0) {
        setActiveChildId(me.children[0].id);
      } else {
        setActiveChildId(null);
      }
    },
    [setActiveChildId]
  );

  const refreshUser = useCallback(async () => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken && !refreshToken) {
      setUser(null);
      setChildrenList([]);
      setIsLoading(false);
      return;
    }

    try {
      const me = await authApi.me();
      hydrateSessionChildren(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearStoredTokens();
        setUser(null);
        setChildrenList([]);
        setActiveChildId(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hydrateSessionChildren, setActiveChildId]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    return onAuthExpired(() => {
      setUser(null);
      setChildrenList([]);
    });
  }, []);

  const establishAuthenticatedSession = useCallback(
    async (res: {
      access_token: string;
      refresh_token: string;
      user: UserSummary;
    }): Promise<UserSummary> => {
      setStoredTokens(res.access_token, res.refresh_token);
      setUser(res.user);
      try {
        const me = await authApi.me();
        hydrateSessionChildren(me);
        return me.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearStoredTokens();
          setUser(null);
          setChildrenList([]);
          setActiveChildId(null);
          throw err;
        }
        return res.user;
      }
    },
    [hydrateSessionChildren, setActiveChildId]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<UserSummary> => {
      const res = await authApi.login({ email, password });
      return establishAuthenticatedSession(res);
    },
    [establishAuthenticatedSession]
  );

  const staffLogin = useCallback(
    async (
      email: string,
      password: string,
      accessCode: string
    ): Promise<UserSummary> => {
      const res = await authApi.staffLogin({
        email,
        password,
        access_code: accessCode,
      });
      return establishAuthenticatedSession(res);
    },
    [establishAuthenticatedSession]
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      full_name: string;
      privacy_consent_accepted: boolean;
    }): Promise<UserSummary> => {
      const res = await authApi.register(payload);
      return establishAuthenticatedSession(res);
    },
    [establishAuthenticatedSession]
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Clear local session regardless of server response
    } finally {
      clearStoredTokens();
      setUser(null);
      setChildrenList([]);
      setActiveChildId(null);
    }
  }, [setActiveChildId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        childrenList,
        activeChildId,
        setActiveChildId,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        staffLogin,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }
  return ctx;
}
