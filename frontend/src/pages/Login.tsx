import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthStore } from "#/hooks/useAuth";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Spinner } from "#/components/ui/spinner";
import { api } from "#/lib/api";
import { decodeAccessToken } from "#/lib/jwt";
import { isAxiosError } from "axios";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen enthalten"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await api.post<{
        access_token: string;
        token_type: string;
      }>("/auth/login", {
        email: data.email,
        password: data.password,
      });

      const { access_token } = response.data;
      const claims = decodeAccessToken(access_token);

      setAuth({
        id: claims.sub,
        email: data.email,
        role: claims.role,
        accessToken: access_token,
      });

      toast.success("Anmeldung erfolgreich", {
        description: `Willkommen zurück, ${data.email.split("@")[0]}. Weiterleitung zum Dashboard...`,
        duration: 3000,
      });

      const from =
        (location.state as { from?: { pathname: string } })?.from?.pathname ||
        "/dashboard";
      navigate(from, { replace: true });
    } catch (err) {
      let message: string;

      if (isAxiosError(err)) {
        if (err.response?.status === 401) {
          message =
            "Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Anmeldedaten.";
        } else if (err.response?.status === 429) {
          message =
            "Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.";
        } else {
          message =
            "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.";
        }
      } else {
        message =
          "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.";
      }

      setServerError(message);
      toast.error("Anmeldung fehlgeschlagen", {
        description: message,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={[
        "p-5",
        "w-full animate-fade-in-up",
        "shadow-card dark:shadow-card-dark",
        "hover:translate-y-0 hover:shadow-card dark:hover:shadow-card-dark",
        // Single lever for the whole card's rhythm — same token Card already
        // uses internally for its "sm" size variant, just dialed up instead
        // of down. Header/content/footer padding and the gap between them
        // all derive from this, so nothing drifts out of alignment.
        "[--card-spacing:--spacing(8)]",
      ].join(" ")}
    >
      <CardHeader className="flex flex-col items-center text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(250_80%_60%)] shadow-glow-primary"
          aria-hidden="true"
        >
          <KeyRound className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-2xl font-semibold tracking-tight text-gradient-primary ">
            IT Automation Dashboard
          </CardTitle>
          <CardDescription className="p-3">
            Melden Sie sich mit Ihren Unternehmensanmeldedaten an
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {serverError && (
            <Alert
              variant="destructive"
              className="animate-fade-in-up items-start gap-3"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <AlertTitle className="text-sm font-semibold leading-none tracking-tight">
                  Anmeldung fehlgeschlagen
                </AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </div>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                placeholder="name@unternehmen.de"
                autoComplete="email"
                autoFocus
                disabled={isLoading}
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
                className="h-11 pl-10 text-base"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                className="h-11 pl-10 pr-10 text-base"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={isLoading}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                aria-label={
                  showPassword ? "Passwort verbergen" : "Passwort anzeigen"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full text-base transition-shadow duration-300 ease-premium hover:shadow-glow-primary"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Anmeldung läuft...
              </>
            ) : (
              "Anmelden"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center py-5 text-xs text-muted-foreground">
        © 2026 IT Operations. Alle Rechte vorbehalten.
      </CardFooter>
    </Card>
  );
}