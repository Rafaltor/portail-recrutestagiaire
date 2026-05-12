export type ConnexionMode = "login" | "signup";

export function buildConnexionHref(
  nextPath: string,
  mode: ConnexionMode = "login",
) {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  if (mode === "signup") params.set("mode", "signup");
  return `/connexion?${params.toString()}`;
}
