import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useCreateAdminSetup, useGetAdminSetupStatus } from "@workspace/api-client-react";

// Matches AdminSetupRequest schema
const setupSchema = z.object({
  organisationTradingName: z.string().min(2, "Trading name is required"),
  administratorForenames: z.string().min(2, "Forename is required"),
  surname: z.string().min(2, "Surname is required"),
  designation: z.string().min(2, "Designation is required"),
  username: z.string().min(4, "Username must be at least 4 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  retypePassword: z.string(),
  productCode: z.string().min(1, "Product code is required"),
}).refine((data) => data.password === data.retypePassword, {
  message: "Passwords do not match",
  path: ["retypePassword"],
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function AdminSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if already set up
  const { data: statusData, isLoading: isCheckingStatus } = useGetAdminSetupStatus();

  useEffect(() => {
    if (statusData?.setupComplete && !isSuccess) {
      setLocation("/setup-complete");
    }
  }, [statusData, setLocation, isSuccess]);

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      organisationTradingName: "",
      administratorForenames: "",
      surname: "",
      designation: "",
      username: "",
      password: "",
      retypePassword: "",
      productCode: "",
    },
  });

  const { mutate: createSetup, isPending } = useCreateAdminSetup({
    mutation: {
      onSuccess: () => {
        setIsSuccess(true);
        toast({
          title: "Setup Successful",
          description: "Administrator account has been created.",
        });
        setTimeout(() => setLocation("/setup-complete"), 1500);
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Setup Failed",
          description: error?.data?.error || "An unexpected error occurred during setup.",
        });
      }
    }
  });

  const onSubmit = (data: SetupFormValues) => {
    createSetup({ data });
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Define form rows structure to map through
  const formFields = [
    { name: "administratorForenames", label: "Administrator's Forename(s)", type: "text" },
    { name: "surname", label: "Surname", type: "text" },
    { name: "designation", label: "Designation", type: "text" },
    { name: "username", label: "Username", type: "text" },
    { name: "password", label: "Password", type: "password" },
    { name: "retypePassword", label: "Retype Password", type: "password" },
    { name: "productCode", label: "Product Code", type: "text" },
  ] as const;

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      
      {/* Left Panel - Branding */}
      <div className="w-full md:w-[40%] lg:w-[35%] bg-primary flex flex-col items-center justify-center p-8 md:p-12 relative overflow-hidden shrink-0">
        {/* Abstract background shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="z-10 flex flex-col items-center text-center"
        >
          {/* Custom Minimalist Hanger Icon */}
          <div className="w-24 h-24 mb-6 relative">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
              <path d="M50 15C46.134 15 43 18.134 43 22C43 25.076 44.9814 27.6853 47.7495 28.6433C48.0649 29.1306 48.463 29.6826 48.9663 30.3444C49.5298 31.0853 50.1983 31.9547 50.8122 32.8465C45.2443 35.1091 21.0504 44.821 16.5 54C14.8878 57.2514 15 62 15 62H85C85 62 85.1122 57.2514 83.5 54C78.9496 44.821 54.7557 35.1091 49.1878 32.8465C49.8017 31.9547 50.4702 31.0853 51.0337 30.3444C51.537 29.6826 51.9351 29.1306 52.2505 28.6433C55.0186 27.6853 57 25.076 57 22C57 18.134 53.866 15 50 15Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M48 24C48 24.5 48 27 50 27C52 27 52 24.5 52 24C52 22.8954 51.1046 22 50 22C48.8954 22 48 22.8954 48 24Z" fill="currentColor"/>
              <line x1="25" y1="62" x2="25" y2="75" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              <line x1="75" y1="62" x2="75" y2="75" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>
          
          <h2 className="text-blue-100/80 font-display font-semibold tracking-wider uppercase text-sm mb-4">
            Smart Fitting Room
          </h2>
          <h1 className="text-white text-4xl md:text-5xl font-display font-bold tracking-tight">
            Hello,<br />Welcome!
          </h1>
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full md:w-[60%] lg:w-[65%] relative flex flex-col justify-center min-h-screen">
        {/* Optional textured background */}
        <div 
          className="absolute inset-0 z-0 opacity-40 mix-blend-multiply pointer-events-none"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/bg-texture.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        
        <div className="z-10 w-full max-w-3xl mx-auto px-6 py-12 md:px-12 lg:px-16">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl font-display font-bold text-foreground mb-8">Administrator Setup</h2>

            <div className="bg-card rounded-xl shadow-xl shadow-black/5 overflow-hidden border border-border/40">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  
                  {/* Specialized First Row */}
                  <div className="flex flex-col sm:flex-row border-b border-border/50">
                    <div className="sm:w-1/3 bg-[#112240] text-white p-4 sm:p-5 flex items-center justify-start">
                      <span className="font-semibold text-sm leading-tight">Organisation<br/>Trading Name</span>
                    </div>
                    <div className="sm:w-2/3 p-4 sm:p-5 bg-card flex items-center">
                      <FormField
                        control={form.control}
                        name="organisationTradingName"
                        render={({ field }) => (
                          <FormItem className="w-full space-y-0">
                            <FormControl>
                              <Input 
                                placeholder="Enter trading name" 
                                className="border-0 bg-secondary/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage className="pt-2" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Read-only ID Row */}
                  <div className="flex flex-col sm:flex-row border-b border-border/50 bg-background/50">
                    <div className="sm:w-1/3 p-4 sm:p-5 flex items-center justify-start text-muted-foreground font-medium text-sm">
                      Organisational ID
                    </div>
                    <div className="sm:w-2/3 p-4 sm:p-5 flex items-center">
                      <div className="h-11 w-full bg-secondary/30 rounded-md border border-border/50 flex items-center px-3 text-muted-foreground italic text-sm cursor-not-allowed">
                        Auto generated
                      </div>
                    </div>
                  </div>

                  {/* Standard Fields */}
                  {formFields.map((f, i) => (
                    <motion.div 
                      key={f.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 + (i * 0.05) }}
                      className="flex flex-col sm:flex-row border-b border-border/50 group hover:bg-secondary/20 transition-colors"
                    >
                      <div className="sm:w-1/3 p-4 sm:p-5 flex items-center justify-start text-foreground font-medium text-sm">
                        {f.label}
                      </div>
                      <div className="sm:w-2/3 p-4 sm:p-5 flex items-center">
                        <FormField
                          control={form.control}
                          name={f.name}
                          render={({ field }) => (
                            <FormItem className="w-full space-y-0">
                              <FormControl>
                                <Input 
                                  type={f.type}
                                  className="h-11 bg-background border-border/60 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all group-hover:border-primary/30" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage className="pt-1.5" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </motion.div>
                  ))}

                  {/* Submit Area */}
                  <div className="p-6 md:p-8 bg-card flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={isPending}
                      className="w-full sm:w-auto min-w-[200px] h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg group relative overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {isPending ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            Activate
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </span>
                      {/* Subtle shine effect on hover */}
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                    </Button>
                  </div>
                  
                </form>
              </Form>
            </div>
            
          </motion.div>
        </div>
      </div>
    </div>
  );
}
