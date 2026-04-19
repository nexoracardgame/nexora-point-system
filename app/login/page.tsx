import LoginClient from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackValue = resolvedSearchParams?.callbackUrl;
  const rawCallbackUrl = Array.isArray(callbackValue)
    ? callbackValue[0]
    : callbackValue;

  return <LoginClient rawCallbackUrl={rawCallbackUrl} />;
}
