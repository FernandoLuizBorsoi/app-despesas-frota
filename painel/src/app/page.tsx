"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Inicio() {
  const router = useRouter();
  useEffect(() => router.replace("/despesas"), [router]);
  return null;
}
