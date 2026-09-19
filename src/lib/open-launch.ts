import type { LaunchMethod } from "@/features/data/schema";
import { launchResource } from "./desktop-launch";

export async function openLaunch(launch: LaunchMethod) {
  return launchResource(launch);
}
