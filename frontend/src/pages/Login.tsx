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
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "#/components/ui/alert";
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
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          IT Automation Dashboard
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Melden Sie sich mit Ihren Unternehmensanmeldedaten an
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@unternehmen.de"
              autoComplete="email"
              autoFocus
              disabled={isLoading}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isLoading}
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={
                errors.password ? "password-error" : undefined
              }
              {...register("password")}
            />
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
            className="w-full"
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
      <CardFooter className="flex justify-center text-xs text-muted-foreground">
        © 2026 IT Operations. Alle Rechte vorbehalten.
      </CardFooter>
    </Card>
  );
}