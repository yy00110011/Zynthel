"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectDetail } from "@/features/projects/project-detail";

function ProjectDetailContent() {
  const id = useSearchParams().get("id") ?? "";
  return <ProjectDetail id={id} />;
}

export default function ProjectDetailPage() {
  return <Suspense fallback={<div className="empty-state">正在加载项目…</div>}><ProjectDetailContent /></Suspense>;
}
