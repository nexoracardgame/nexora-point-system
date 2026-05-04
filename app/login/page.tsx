import LoginClient from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackValue = resolvedSearchParams?.callbackUrl;
  const errorValue = resolvedSearchParams?.error;
  const rawCallbackUrl = Array.isArray(callbackValue)
    ? callbackValue[0]
    : callbackValue;
  const authError = Array.isArray(errorValue) ? errorValue[0] : errorValue;

  return <LoginClient rawCallbackUrl={rawCallbackUrl} authError={authError} />;
}
