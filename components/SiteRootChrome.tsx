"use client";

import FirstOpenSplash from "@/components/FirstOpenSplash";
import GlobalActivityBar from "@/components/GlobalActivityBar";
import InstantNavigationFeedback from "@/components/InstantNavigationFeedback";
import PageTransition from "@/components/PageTransition";

export default function SiteRootChrome({ children }: { children: React.ReactNode }) {
  return <><FirstOpenSplash /><GlobalActivityBar /><InstantNavigationFeedback /><PageTransition><div className="flex min-h-0 flex-1 flex-col">{children}</div></PageTransition></>;
}
