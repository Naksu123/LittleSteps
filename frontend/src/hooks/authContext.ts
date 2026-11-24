"use client";

import { createContext, useContext } from "react";
import type { Child, ParentPreferences, UserSummary } from "@/types";

export interface AuthContextValue {
  user: UserSummary | null;
  childrenList: Child[];
  activeChildId: string | null;
  parentPreferences: ParentPreferences | null;
  setParentPreferences: (prefs: ParentPreferences | null) => void;
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

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext) ?? null;
}
