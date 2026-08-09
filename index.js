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

    // মূল বেস ইউআরএল এবং প্রক্সি বেস
    const API_BASE = "https://allinonereborn2.online/sony-new/playlists/";
    const PROXY_BASE = "https://allinonereborn2.online/livtest3/stream_proxy.php?url=";

    let finalTargetUrl = "";
    let currentChannel = "";

    // হেল্পার ফাংশন: Base64 এনকোড ও ডিকোড (URL Safe)
    const encodeBase64 = (str) => btoa(encodeURIComponent(str)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const decodeBase64 = (b64) => {
      try {
        let pad = b64.length % 4;
        if (pad) { b64 += "=".repeat(4 - pad); }
        return decodeURIComponent(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
      } catch (e) {
        return "";
      }
    };

    // ২. রাউটিং প্যাটার্ন ম্যাচিং
    // প্যাটার্ন ক: /channel_name/playlist.m3u8 (মূল ভেরিয়েন্ট প্লেলিস্ট)
    const variantMatch = pathname.match(/^\/([^\/]+)\/playlist\.m3u8$/);
    
    // প্যাটার্ন খ: /channel_name/base64_encoded_string/index.m3u8 (সাব-প্লেলিস্ট)
    const subPlaylistMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)\/index\.m3u8$/);
    
    // প্যাটার্ন গ: /channel_name/base64_encoded_string.ts (মিডিয়া সেগমেন্ট)
    const tsMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)\.ts$/);

    if (variantMatch) {
      currentChannel = variantMatch[1];
      finalTargetUrl = `${PROXY_BASE}${encodeURIComponent(API_BASE + currentChannel + ".m3u8")}`;
    } else if (subPlaylistMatch) {
      currentChannel = subPlaylistMatch[1];
      const decodedTarget = decodeBase64(subPlaylistMatch[2]);
      finalTargetUrl = decodedTarget;
    } else if (tsMatch) {
      currentChannel = tsMatch[1];
      const decodedTarget = decodeBase64(tsMatch[2]);
      finalTargetUrl = decodedTarget;
    } else {
      return new Response("Error: Invalid route format", { status: 400 });
    }

    // ৩. মূল সার্ভারের জন্য নির্দিষ্ট সব হেডারসমূহ
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

      // ৪. m3u8 প্লেলিস্ট হলে লিঙ্ক বা সেগমেন্টগুলো রিরাইট করা
      if (finalTargetUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
        let text = await response.text();
        
        // বেস ইউআরএল বের করা যাতে রিলেটিভ পাথ ঠিক থাকে
        const playlistBase = finalTargetUrl.substring(0, finalTargetUrl.lastIndexOf("/") + 1);

        const newBody = text.split("\n").map(line => {
          line = line.trim();
          if (!line) return "";

          if (line.startsWith("#")) {
            if (line.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/g, (match, p1) => {
                let absUri = p1.startsWith("http") ? p1 : playlistBase + p1;
                // കീ এনক্রিপশন বা DRM ইউআরআই হ্যান্ডলিং (.ts বা .m3u8 যাই হোক)
                if (absUri.includes(".m3u8")) {
                  return `URI="/${currentChannel}/${encodeBase64(absUri)}/index.m3u8"`;
                } else {
                  return `URI="/${currentChannel}/${encodeBase64(absUri)}.ts"`;
                }
              });
            }
            return line;
          } else {
            // সাধারণ লাইন বা সেগমেন্ট লিংক
            let absUrl = line.startsWith("http") ? line : playlistBase + line;
            
            if (absUrl.includes(".m3u8")) {
              return `/${currentChannel}/${encodeBase64(absUrl)}/index.m3u8`;
            } else {
              return `/${currentChannel}/${encodeBase64(absUrl)}.ts`;
            }
          }
        }).join("\n");

        return new Response(newBody, {
          headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" }
        });
      }

      // ৫. ভিডিও ডাটা (.ts বা অন্যান্য ফাইল) সরাসরি রিটার্ন
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" }
      });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};
