import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { useEffect, useRef } from "react";
import { useSyncProfile, getGetProfileQueryKey } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Home from "@/pages/public/Home";
import Packages from "@/pages/public/Packages";
import PackageDetail from "@/pages/public/PackageDetail";
import BecomeAgent from "@/pages/public/BecomeAgent";
import About from "@/pages/public/About";
import Contact from "@/pages/public/Contact";
import Privacy from "@/pages/public/Privacy";
import Terms from "@/pages/public/Terms";
import FAQ from "@/pages/public/FAQ";
import SignInPage from "@/pages/auth/SignInPage";
import SignUpPage from "@/pages/auth/SignUpPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import AuthRedirectPage from "@/pages/auth/AuthRedirectPage";

import UserDashboard from "@/pages/dashboard/UserDashboard";
import AgentPortal from "@/pages/agent/AgentPortal";
import AdminConsole from "@/pages/admin/AdminConsole";
import FlightsModule from "@/pages/flights";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ProfileSyncer() {
  const { user, isLoaded } = useUser();
  const syncProfile = useSyncProfile();
  const synced = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoaded || !user || synced.current) return;
    synced.current = true;
    syncProfile.mutate(
      {
        data: {
          clerkUserId: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? "",
          fullName: user.fullName ?? user.firstName ?? "Pilgrim",
          avatarUrl: user.imageUrl,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        },
      }
    );
  }, [isLoaded, user]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        client.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/packages" component={Packages} />
      <Route path="/packages/:id" component={PackageDetail} />
      <Route path="/become-agent" component={BecomeAgent} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/faq" component={FAQ} />

      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/forgot-password/*?" component={ForgotPasswordPage} />
      <Route path="/auth/redirect" component={AuthRedirectPage} />

      <Route path="/dashboard/*?" component={UserDashboard} />
      <Route path="/agent/*?" component={AgentPortal} />
      <Route path="/admin/*?" component={AdminConsole} />
      <Route path="/flights/*?" component={FlightsModule} />

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return <div>Missing VITE_CLERK_PUBLISHABLE_KEY</div>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      appearance={{
        variables: {
          colorPrimary: "#2D3199",
          colorBackground: "#ffffff",
          colorInputBackground: "#ffffff",
          colorText: "#0F172A",
          colorTextSecondary: "#64748B",
          borderRadius: "0.75rem",
          fontFamily: "Lato, sans-serif",
        },
        elements: {
          formButtonPrimary: "bg-[#2D3199] hover:bg-[#25297F] text-white font-bold shadow-none",
          card: "shadow-none border-0",
          headerTitle: "text-[#0F172A] font-black",
          headerSubtitle: "text-[#64748B]",
          socialButtonsBlockButton: "border border-[#DCE3F0] text-[#334155] hover:bg-[#F1F5F9] font-semibold",
          dividerLine: "bg-[#DCE3F0]",
          dividerText: "text-[#94A3B8] text-xs",
          formFieldInput: "border-[#DCE3F0] focus:border-[#2D3199] focus:ring-[#2D3199]/20 rounded-xl",
          formFieldLabel: "text-[#334155] font-semibold text-sm",
          footerActionLink: "text-[#2D3199] hover:text-[#25297F] font-semibold",
          identityPreviewEditButton: "text-[#2D3199]",
          formResendCodeLink: "text-[#2D3199]",
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ProfileSyncer />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
