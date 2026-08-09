export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ১. রুট রিকোয়েস্টে index.html লোড করা
    if (pathname === "/" || pathname === "") {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTTking Stream Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; background: #121212; color: #fff; text-align: center; padding-top: 50px; }
        h1 { color: #e50914; }
        p { color: #aaa; }
    </style>
</head>
<body>
    <h1>Welcome to OTTking Stream Proxy</h1>
    <p>Worker is running successfully!</p>
</body>
</html>`;

      return new Response(htmlContent, {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // ২. সেগমেন্ট বা ডাইরেক্ট ইউআরএল (?url=...) হ্যান্ডেল করার জন্য
    const targetUrl = url.searchParams.get("url");
    let finalTargetUrl = "";
    let playlistBase = "";

    const API_BASE = "https://allinonereborn2.online/sony-new/playlists/";
    const PROXY_BASE = "https://allinonereborn2.online/livtest3/stream_proxy.php?url=";

    // ৩. পাথ থেকে চ্যানেল নাম ও প্লেলিস্ট চেক করা (যেমন: /sony_ten4/playlist.m3u8)
    const match = pathname.match(/^\/([^\/]+)\/playlist\.m3u8$/);

    if (match) {
      const channel = match[1];
      finalTargetUrl = `${PROXY_BASE}${encodeURIComponent(API_BASE + channel + ".m3u8")}`;
      playlistBase = API_BASE;
    } else if (targetUrl) {
      finalTargetUrl = targetUrl;
      playlistBase = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
    } else {
      return new Response("Error: Invalid route or missing parameters", { status: 400 });
    }

    // ৪. নির্দিষ্ট হেডারসমূহ
    const customHeaders = {
      "User-Agent": "Mozilla/5.0 (Android 13; Mobile; rv:150.0) Gecko/150.0 Firefox/150.0",
      "Accept": "*/*",
      "Accept-Language": "en-US",
      "Referer": "https://allinonereborn2.online/sony/ptest.php?id=sony-ten-4",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin"
    };

    try {
      const response = await fetch(finalTargetUrl, { headers: customHeaders });
      const contentType = response.headers.get("Content-Type") || "";

      // ৫. m3u8 প্লেলিস্ট হলে সেগমেন্ট রিরাইট করা
      if (finalTargetUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
        let text = await response.text();
        
        // সেগমেন্টগুলো যাতে এই ওয়ার্কার দিয়েই পাস হয়
        const workerUrl = `${url.origin}${url.pathname}?url=`;

        const newBody = text.split("\n").map(line => {
          line = line.trim();
          if (!line) return "";

          if (line.startsWith("#")) {
            if (line.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/g, (match, p1) => {
                let absUri = p1.startsWith("http") ? p1 : playlistBase + p1;
                return `URI="${workerUrl}${encodeURIComponent(absUri)}"`;
              });
            }
            return line;
          } else {
            let absUrl = line.startsWith("http") ? line : playlistBase + line;
            return `${workerUrl}${encodeURIComponent(absUrl)}`;
          }
        }).join("\n");

        return new Response(newBody, {
          headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" }
        });
      }

      // ৬. ভিডিও ডাটা (.ts) সরাসরি রিটার্ন
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" }
      });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};
