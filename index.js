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

    // ২. মূল বেস ইউআরএল এবং প্রক্সি বেস
    const API_BASE = "https://allinonereborn2.online/sony-new/playlists/";
    const PROXY_BASE = "https://allinonereborn2.online/livtest3/stream_proxy.php?url=";

    let finalTargetUrl = "";
    let currentChannel = "";
    let requestedResolution = null;

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

    // ৩. রাউটিং প্যাটার্ন ম্যাচিং
    // ক. /channel_name/playlist.m3u8 (মূল ভেরিয়েন্ট প্লেলিস্ট)
    const variantMatch = pathname.match(/^\/([^\/]+)\/playlist\.m3u8$/);
    
    // খ. /channel_name/resolution_or_base64/index.m3u8 (রেজুলেশন ফিল্টার অথবা সাব-প্লেলিস্ট)
    const resMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)\/index\.m3u8$/);
    let isResolutionRequest = false;
    
    if (resMatch) {
      const secondPart = resMatch[2];
      // যদি এটি বেস৬৫ স্ট্রিং না হয়ে রেজুলেশন নাম হয় (যেমন 720p, 1080p ইত্যাদি)
      if (!secondPart.includes("==") && (secondPart.toLowerCase().includes("p") || !isNaN(secondPart) || secondPart.includes("_"))) {
        isResolutionRequest = true;
      }
    }

    const subPlaylistMatch = !isResolutionRequest ? resMatch : null;
    
    // গ. /channel_name/base64_encoded_string.ts (মিডিয়া সেগমেন্ট)
    const tsMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)\.ts$/);

    if (variantMatch) {
      currentChannel = variantMatch[1];
      finalTargetUrl = `${PROXY_BASE}${encodeURIComponent(API_BASE + currentChannel + ".m3u8")}`;
    } else if (isResolutionRequest) {
      currentChannel = resMatch[1];
      requestedResolution = resMatch[2].toLowerCase();
      finalTargetUrl = `${PROXY_BASE}${encodeURIComponent(API_BASE + currentChannel + ".m3u8")}`;
    } else if (subPlaylistMatch) {
      currentChannel = subPlaylistMatch[1];
      finalTargetUrl = decodeBase64(subPlaylistMatch[2]);
    } else if (tsMatch) {
      currentChannel = tsMatch[1];
      finalTargetUrl = decodeBase64(tsMatch[2]);
    } else {
      return new Response("Error: Invalid route format", { status: 400 });
    }

    // ৪. মূল সার্ভারের জন্য নির্দিষ্ট সব হেডারসমূহ
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
      let text = await response.text();
      const contentType = response.headers.get("Content-Type") || "";

      // ৫. যদি নির্দিষ্ট রেজুলেশন রিকোয়েস্ট হয়, তবে মাস্টার প্লেলিস্ট থেকে তা ফিল্টার করা
      if (requestedResolution) {
        const playlistBase = finalTargetUrl.substring(0, finalTargetUrl.lastIndexOf("/") + 1);
        const lines = text.split("\n");
        let targetSubPlaylistUrl = "";

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          if (line.startsWith("#EXT-X-STREAM-INF")) {
            if (line.toLowerCase().includes(requestedResolution) || (i + 1 < lines.length && lines[i+1].toLowerCase().includes(requestedResolution))) {
              let nextLine = lines[i + 1].trim();
              targetSubPlaylistUrl = nextLine.startsWith("http") ? nextLine : playlistBase + nextLine;
              break;
            }
          }
        }

        // যদি কাঙ্ক্ষিত রেজুলেশন না মেলে, তবে ডিফল্ট প্রথম সাব-প্লেলিস্ট বেছে নেওয়া
        if (!targetSubPlaylistUrl) {
          for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line && !line.startsWith("#")) {
              targetSubPlaylistUrl = line.startsWith("http") ? line : playlistBase + line;
              break;
            }
          }
        }

        if (targetSubPlaylistUrl) {
          const subRes = await fetch(targetSubPlaylistUrl, { headers: customHeaders });
          text = await subRes.text();
          finalTargetUrl = targetSubPlaylistUrl;
        }
      }

      // ৬. m3u8 প্লেলিস্ট হলে লিঙ্ক বা সেগমেন্টগুলো রিরাইট করা
      if (finalTargetUrl.includes(".m3u8") || contentType.includes("mpegurl") || requestedResolution) {
        const playlistBase = finalTargetUrl.substring(0, finalTargetUrl.lastIndexOf("/") + 1);

        const newBody = text.split("\n").map(line => {
          line = line.trim();
          if (!line) return "";

          if (line.startsWith("#")) {
            if (line.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/g, (match, p1) => {
                let absUri = p1.startsWith("http") ? p1 : playlistBase + p1;
                if (absUri.includes(".m3u8")) {
                  return `URI="/${currentChannel}/${encodeBase64(absUri)}/index.m3u8"`;
                } else {
                  return `URI="/${currentChannel}/${encodeBase64(absUri)}.ts"`;
                }
              });
            }
            return line;
          } else {
            let absUrl = line.startsWith("http") ? line : playlistBase + line;
            
            if (absUrl.includes(".m3u8")) {
              return `/${currentChannel}/${encodeBase64(absUrl)}/index.m3u8`;
            } else {
              return `/${currentChannel}/${encodeBase64(absUrl)}.ts`;
            }
          }
        }).join("\n");

        return new Response(newBody, {
          headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*" }
        });
      }

      // ৭. ভিডিও ডাটা (.ts বা অন্যান্য ফাইল) সরাসরি রিটার্ন
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" }
      });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};
