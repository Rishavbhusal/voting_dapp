import { ReactNode } from "react";
import ClientProviders from "./client-providers";
import "@/index.css";

export const metadata = {
  title: "VoteDApp - Decentralized Voting on Solana",
  description: "Transparent, secure, and trustless voting on the Solana blockchain. Cast your vote and make your voice heard.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

