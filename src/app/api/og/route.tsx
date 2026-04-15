import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Dynamic params
    const title = searchParams.get("title") || "Community Note";
    const category = searchParams.get("category") || "Resource";
    
    // Choose gradient based on first letter of category to be somewhat deterministic
    const charCode = category.charCodeAt(0) % 5;
    
    const gradients = [
      "linear-gradient(135deg, #4f46e5 0%, #a855f7 100%)", // Indigo/Purple
      "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)", // Pink/Rose
      "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)", // Sky/Blue
      "linear-gradient(135deg, #10b981 0%, #059669 100%)", // Emerald/Green
      "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)"  // Amber/Orange
    ];
    
    const backgroundStyle = gradients[charCode] || gradients[0];

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: backgroundStyle,
            padding: "72px",
            fontFamily: "Inter, sans-serif",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Glassmorphism subtle overlay circles */}
          <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, background: "rgba(255,255,255,0.1)", borderRadius: "50%", filter: "blur(40px)" }} />
          <div style={{ position: "absolute", bottom: -50, left: -50, width: 300, height: 300, background: "rgba(0,0,0,0.15)", borderRadius: "50%", filter: "blur(40px)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.18) 100%)" }} />
          
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: title.length > 46 ? 56 : title.length > 28 ? 66 : 76,
                fontWeight: 900,
                color: "white",
                lineHeight: 1.12,
                margin: 0,
                width: "92%",
                maxWidth: "1040px",
                textAlign: "center",
                letterSpacing: "-0.02em",
                textShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {title}
            </h1>
          </div>

        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error: unknown) {
    console.error("Failed to generate OG image", error);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
