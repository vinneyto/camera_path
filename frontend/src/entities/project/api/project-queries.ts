"use client";

import { useQuery } from "@tanstack/react-query";

import { projectApi } from "./project-api";

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (projectId: string) => [...projectKeys.all, "detail", projectId] as const,
  trajectory: (projectId: string) => [...projectKeys.all, "trajectory", projectId] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: projectApi.list,
  });
}

export function useProjectQuery(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectApi.get(projectId),
  });
}

export function useCompiledTrajectoryQuery(projectId: string) {
  return useQuery({
    queryKey: projectKeys.trajectory(projectId),
    queryFn: () => projectApi.compile(projectId),
  });
}
