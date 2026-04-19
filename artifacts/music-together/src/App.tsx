import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Room from "@/pages/room";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#c07080",
    colorBackground: "#fdf6f0",
    colorInputBackground: "#fffaf7",
    colorText: "#4a3028",
    colorTextSecondary: "#8b6055",
    colorInputText: "#4a3028",
    colorNeutral: "#c0a098",
    borderRadius: "16px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontFamilyButtons: "'Inter', 'Segoe UI', sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "rounded-3xl w-full overflow-hidden shadow-2xl shadow-primary/10 border border-[#e8d5cf]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "#4a3028", fontWeight: "700", fontSize: "22px" },
    headerSubtitle: { color: "#8b6055" },
    socialButtonsBlockButtonText: { color: "#4a3028", fontWeight: "500" },
    formFieldLabel: { color: "#6b4a40" },
    footerActionText: { color: "#8b6055" },
    footerActionLink: { color: "#c07080", fontWeight: "600" },
    dividerText: { color: "#c0a098" },
    alertText: { color: "#c05050" },
    formFieldSuccessText: { color: "#50a050" },
    identityPreviewEditButton: { color: "#c07080" },
    logoBox: "mx-auto mb-1 flex justify-center",
    logoImage: "w-14 h-14 rounded-2xl shadow-md",
    socialButtonsBlockButton: "border-[#e0c8c0] hover:bg-[#fce8e8] rounded-2xl transition-all",
    formButtonPrimary:
      "bg-gradient-to-r from-[#c07080] to-[#d4909a] hover:from-[#b06070] hover:to-[#c4808a] text-white rounded-2xl shadow-md font-semibold",
    formFieldInput: "border-[#e0c8c0] rounded-2xl focus:ring-[#c07080]/30 bg-[#fffaf7]",
    footerAction: "bg-[#fdf0ec]",
    dividerLine: "bg-[#e8d5cf]",
    alert: "rounded-2xl border-[#f0c0c0]",
    otpCodeFieldInput: "border-[#e0c8c0] rounded-xl",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #fdf6f0, #fce8e8, #eef5ef)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-sm text-[#8b6055] italic">"Nghe nhạc cùng nhau, dù ở đâu"</p>
        </div>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/`}
        />
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #fdf6f0, #fce8e8, #eef5ef)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-sm text-[#8b6055] italic">"Nghe nhạc cùng nhau, dù ở đâu"</p>
        </div>
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/`}
        />
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== id) {
        qc.clear();
      }
      prevUserIdRef.current = id;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/room/:roomId" component={Room} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Chào mừng trở lại! 🎵",
            subtitle: "Đăng nhập để lưu tên và ảnh đại diện",
          },
        },
        signUp: {
          start: {
            title: "Tạo tài khoản 🎶",
            subtitle: "Tham gia Music Together ngay hôm nay",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
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
