"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, orvalFetch } from "@/shared/api/orval-fetch";

interface AuthContextValue {
  canEdit: boolean;
  loading: boolean;
  username: string | null;
  error: Error | null;
  pending: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = ["editor-session"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async ({ signal }) => {
      try {
        const response = await orvalFetch<{ data: { username: string } }>(
          "/api/v1/auth/session",
          { method: "GET", signal },
        );
        return response.data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const expire = () => queryClient.setQueryData(SESSION_KEY, null);
    window.addEventListener("camera-path-auth-expired", expire);
    return () => window.removeEventListener("camera-path-auth-expired", expire);
  }, [queryClient]);

  async function login(username: string, password: string) {
    setPending(true);
    setError(null);
    await queryClient.cancelQueries({ queryKey: SESSION_KEY });
    try {
      await orvalFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    } catch (error) {
      setError(error instanceof Error ? error : new Error("Sign in failed"));
      throw error;
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError(null);
    await queryClient.cancelQueries({ queryKey: SESSION_KEY });
    try {
      await orvalFetch("/api/v1/auth/logout", { method: "POST" });
      queryClient.setQueryData(SESSION_KEY, null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        queryClient.setQueryData(SESSION_KEY, null);
      else
        setError(error instanceof Error ? error : new Error("Sign out failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        canEdit: !!session.data && !session.isError,
        loading: session.isPending,
        username: session.data?.username ?? null,
        error: error ?? session.error,
        pending,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
