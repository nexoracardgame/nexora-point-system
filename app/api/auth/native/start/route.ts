import { NextRequest, NextResponse } from "next/server";
import { sanitizeNativeCallbackPath } from "@/lib/native-auth";

const PROVIDERS = new Set(["line", "google"]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const provider = String(request.nextUrl.searchParams.get("provider") || "");

  if (!PROVIDERS.has(provider)) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(loginUrl);
  }

  const callbackPath = sanitizeNativeCallbackPath(
    request.nextUrl.searchParams.get("callbackUrl")
  );
  const nativeIssueUrl = new URL("/api/auth/native/issue", request.nextUrl.origin);
  nativeIssueUrl.searchParams.set("callbackUrl", callbackPath);

  const csrfUrl = new URL("/api/auth/csrf", request.nextUrl.origin);
  const signInUrl = new URL(`/api/auth/signin/${provider}`, request.nextUrl.origin);
  const escapedCallbackUrl = escapeHtml(nativeIssueUrl.toString());
  const escapedCsrfUrl = escapeHtml(csrfUrl.toString());
  const escapedSignInUrl = escapeHtml(signInUrl.toString());

  return new NextResponse(
    `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>NEXORA TCG Login</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#fff;font-family:Arial,sans-serif}
    main{width:min(360px,calc(100vw - 40px));text-align:center}
    .spinner{width:48px;height:48px;margin:0 auto 20px;border:4px solid rgba(255,255,255,.18);border-top-color:#06c755;border-radius:50%;animation:spin .8s linear infinite}
    button{margin-top:18px;border:0;border-radius:18px;background:#06c755;color:#fff;font-weight:800;padding:14px 18px;width:100%}
    p{color:rgba(255,255,255,.68);line-height:1.5}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <main>
    <div class="spinner" aria-hidden="true"></div>
    <h1>กำลังเข้าสู่ระบบ NEXORA TCG</h1>
    <p>หลังยืนยันบัญชีเสร็จ ระบบจะพากลับเข้าแอพอัตโนมัติ</p>
    <form id="signin" method="post" action="${escapedSignInUrl}">
      <input type="hidden" name="csrfToken" id="csrfToken" />
      <input type="hidden" name="callbackUrl" value="${escapedCallbackUrl}" />
      <button type="submit">ดำเนินการต่อ</button>
    </form>
  </main>
  <script>
    (async function () {
      try {
        var res = await fetch("${escapedCsrfUrl}", { credentials: "same-origin" });
        var data = await res.json();
        document.getElementById("csrfToken").value = data.csrfToken || "";
        document.getElementById("signin").submit();
      } catch (error) {
        document.querySelector("button").disabled = false;
      }
    })();
  </script>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
