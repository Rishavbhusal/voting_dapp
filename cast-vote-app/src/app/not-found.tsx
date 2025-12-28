"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      <div className="container mx-auto px-4 pt-24">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-6xl font-bold mb-4 gradient-text">404</h1>
          <h2 className="text-3xl font-semibold mb-4">Page Not Found</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <Button variant="gradient" size="lg">
              Go Back Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

