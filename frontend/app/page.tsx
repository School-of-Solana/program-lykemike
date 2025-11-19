"use client";

import dynamic from "next/dynamic";

// Dynamically import the WalletConnector with SSR disabled
const WalletConnector = dynamic(() => import("./components/WalletConnector"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="text-xl font-semibold text-gray-700">Loading...</div>
    </div>
  ),
});

export default function Home() {
  return <WalletConnector />;
}
