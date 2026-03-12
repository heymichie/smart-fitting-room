import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center px-4">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
        </div>
        <h1 className="text-4xl font-display font-bold text-foreground mb-3">404</h1>
        <h2 className="text-xl font-semibold text-foreground/80 mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button size="lg" className="px-8">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
