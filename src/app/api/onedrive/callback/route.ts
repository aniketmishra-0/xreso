import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/onedrive";

// GET /api/onedrive/callback — Handle OAuth redirect from Microsoft
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.json({
        error: `Microsoft OAuth error: ${error}`,
        description: searchParams.get("error_description"),
      }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ error: "No authorization code received" }, { status: 400 });
    }

    await exchangeCodeForTokens(code);

    // Return a nice success page
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>OneDrive Connected</title>
        <style>
          body { font-family: system-ui; background: #0f0a1a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { text-align: center; padding: 48px; border-radius: 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); max-width: 480px; }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { font-size: 24px; margin-bottom: 12px; }
          p { color: #999; line-height: 1.6; }
          a { color: #8b5cf6; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>OneDrive Connected!</h1>
            <p>Your personal OneDrive is now linked to Xreso.<br/>
            Uploaded files will be auto-organized into language folders.</p>
            <p style="margin-top: 24px;"><a href="/home">← Back to Xreso</a></p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("OneDrive callback error:", error);
    return NextResponse.json({
      error: "Failed to complete OneDrive setup",
      details: String(error),
    }, { status: 500 });
  }
}
