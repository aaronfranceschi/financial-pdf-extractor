import { NextRequest, NextResponse } from "next/server";

function isAllowedProxy(hostname: string) {
  return hostname === "drive.google.com" || hostname.endsWith(".googleusercontent.com");
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "https:" || !isAllowedProxy(parsed.hostname)) {
      return NextResponse.json({ error: "URL host not permitted" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const upstream = await fetch(parsed.href, {
    redirect: "follow",
    headers: { "User-Agent": "financial-pdf-extractor-demo/1.0" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream fetch failed", status: upstream.status },
      { status: 502 },
    );
  }

  const buf = Buffer.from(await upstream.arrayBuffer());

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type")?.includes("pdf")
      ? "application/pdf"
      : upstream.headers.get("content-type") || "application/pdf",
  );
  headers.set("Content-Length", String(buf.length));
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");

  return new NextResponse(buf, { status: 200, headers });
}
