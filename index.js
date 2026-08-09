export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname || "/";
    let channel = url.searchParams.get("channel"); // এখানে শুধু চ্যানেলের নাম দিবেন

    // রুট ল্যান্ডিং পেজ
    if (pathname === "/" || pathname === "/index.html") {
      return new Response(getRootHtml(url.origin), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // চ্যানেল HTML প্লেয়ার পেজ
    const channelPageMatch = pathname.match(/^\/([^/]+)\/index\.m3u8$/);
    if (channelPageMatch) {
      return new Response(getChannelHtml(channelPageMatch[1], url.origin), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // সাপোর্ট: /hidden/<channel> পাথ থেকে চ্যানেল নেয়ার সুবিধা
    const hiddenRouteMatch = pathname.match(/^\/hidden\/([^/]+)$/);
    if (!channel && hiddenRouteMatch) {
      channel = hiddenRouteMatch[1];
    }

    // ১. আপনার মূল বেস ইউআরএল সেটআপ (ইনভায়রনমেন্ট/সিক্রেট থেকে নেওয়া হবে)
    const API_BASE = env.API_BASE || env.MAIN_SERVER_URL || "";
    const PROXY_BASE = env.PROXY_BASE || env.PROXY_BASE_URL || "";

    // যদি সরাসরি কোনো পূর্ণাঙ্গ ইউআরএল প্রক্সি করার প্রয়োজন হয় (সেগমেন্টের জন্য)
    const targetUrl = url.searchParams.get("url");

    let finalTargetUrl = "";

    if (channel) {
        // যদি ইনপুট দেয় 'sony_ten4', তবে এটি তৈরি করবে মূল লিঙ্ক
        finalTargetUrl = `${PROXY_BASE}${encodeURIComponent(API_BASE + channel + ".m3u8")}`;
    } else if (targetUrl) {
        // সেগমেন্ট বা অন্য কোনো ডাইরেক্ট লিঙ্কের জন্য
        finalTargetUrl = targetUrl;
    } else {
        return new Response("Error: Please provide ?channel=name", { status: 400 });
    }

    // ২. নির্দিষ্ট হেডারসমূহ
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

      // ৩. m3u8 প্লেলিস্ট হলে সেগমেন্ট রিরাইট করা
      if (finalTargetUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
        let text = await response.text();
        
        // সেগমেন্টগুলো যাতে আবার এই ওয়ার্কার দিয়েই যায়
        const workerUrl = `${url.origin}${url.pathname}?url=`;
        
        // বেস ইউআরএল বের করা যাতে রিলেটিভ পাথ ঠিক থাকে
        const playlistBase = finalTargetUrl.substring(0, finalTargetUrl.lastIndexOf("/") + 1);

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

      // ৪. ভিডিও ডাটা (.ts) সরাসরি রিটার্ন
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" }
      });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};

function getRootHtml(origin) {
  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Channel Proxy Worker</title>
  <style>body{font-family:system-ui, sans-serif;margin:0;padding:2rem;background:#111;color:#f8f8f8;}a{color:#4fc3f7;}code{background:#222;padding:.2rem .4rem;border-radius:.3rem;}</style>
</head>
<body>
  <h1>Worker Proxy</h1>
  <p>Use a channel page or hidden proxy endpoint.</p>
  <ul>
    <li><a href="/sony_ten4/index.m3u8">/sony_ten4/index.m3u8</a> — HTML player page</li>
    <li><code>/hidden/sony_ten4</code> — stream proxy endpoint</li>
    <li><code>?channel=sony_ten4</code> — query-based proxy</li>
  </ul>
  <p>Example channel page: <a href="/sony_ten4/index.m3u8">/sony_ten4/index.m3u8</a></p>
  <p>অনুগ্রহ করে সিক্রেট হিসেবে <code>API_BASE</code> ও <code>PROXY_BASE</code> সেট করুন।</p>
</body>
</html>`;
}

function getChannelHtml(channel, origin) {
  const streamUrl = `${origin}/hidden/${encodeURIComponent(channel)}`;
  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PLAY: ${channel}</title>
  <style>body{margin:0;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;}#player{width:100%;max-width:980px;height:60vh;background:#000;} .info{position:absolute;top:1rem;left:1rem;right:1rem;font-size:0.95rem;}</style>
</head>
<body>
  <div class="info">Channel: <strong>${channel}</strong> · Source: <a href="${streamUrl}" style="color:#8df;">hidden proxy</a></div>
  <video id="player" controls autoplay playsinline muted></video>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.0/dist/hls.min.js"></script>
  <script>
    const video = document.getElementById('player');
    const src = '${streamUrl}';
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (window.Hls) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, function(event, data) {
        console.error('HLS error', data);
      });
    } else {
      document.body.innerHTML = '<p style="color:#f66;">এই ব্রাউজারে HLS প্লে করতে পারে না।</p>';
    }
  </script>
</body>
</html>`;
}
