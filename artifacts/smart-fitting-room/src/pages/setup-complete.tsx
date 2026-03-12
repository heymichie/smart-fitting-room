import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SetupComplete() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/50 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-card p-8 rounded-2xl shadow-xl shadow-primary/5 border border-border/50 text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </motion.div>
        
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">Setup Complete</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          The smart fitting room system has already been configured for your organisation.
        </p>
        
        <Link href="/" className="w-full inline-block">
          <Button className="w-full text-base py-6 rounded-xl bg-primary hover:bg-primary/90" size="lg">
            Return to Login
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
