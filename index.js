export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname || "/";
    let channel = url.searchParams.get("channel"); // এখানে শুধু চ্যানেলের নাম দিবেন

    // রুট/index.html ল্যান্ডিং পেজ
    if (pathname === "/" || pathname === "/index.html") {
      return new Response(getRootHtml(url.origin), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // চ্যানেল প্লেয়ার পেজ
    const channelPageMatch = pathname.match(/^\/([^/]+)\/index\.m3u8$/);
    if (channelPageMatch) {
      return new Response(getChannelHtml(channelPageMatch[1], url.origin), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // /hidden/<channel> রুট সাপোর্ট
    const hiddenRouteMatch = pathname.match(/^\/hidden\/([^/]+)$/);
    if (!channel && hiddenRouteMatch) {
      channel = hiddenRouteMatch[1];
    }

    // ১. আপনার মূল বেস ইউআরএল সেটআপ
    const API_BASE = "https://allinonereborn2.online/sony-new/playlists/";
    const PROXY_BASE = "https://allinonereborn2.online/livtest3/stream_proxy.php?url=";

    // যদি সরাসরি কোনো পূর্ণাঙ্গ ইউআরএল প্রক্সি করার প্রয়োজন হয় (সেগমেন্টের জন্য)
    const targetUrl = url.searchParams.get("url");

    let finalTargetUrl = "";

    if (channel) {
      finalTargetUrl = `${PROXY_BASE}${encodeURIComponent(API_BASE + channel + ".m3u8")}`;
    } else if (targetUrl) {
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
        const workerUrl = `${url.origin}${url.pathname}?url=`;
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
  <title>OTTKing SonyLiv Server</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, sans-serif; background: radial-gradient(circle at top, #0b2545 0%, #070b18 60%, #020406 100%); color: #f8fbff; }
    .page { max-width: 980px; margin: 0 auto; padding: 2rem; }
    header { display: grid; gap: 1rem; padding: 2rem 0; }
    h1 { margin: 0; font-size: clamp(2rem, 4vw, 3.5rem); letter-spacing: -0.04em; }
    .lead { margin: 0; color: #a8caff; font-size: 1.05rem; line-height: 1.8; }
    .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 1.8rem; box-shadow: 0 30px 60px rgba(0,0,0,0.20); }
    .links { display: grid; gap: 1rem; margin-top: 1.5rem; }
    a.button { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; color: white; background: linear-gradient(135deg,#4f9cff,#5bb4ff); border-radius: 999px; padding: 0.95rem 1.5rem; font-weight: 700; box-shadow: 0 18px 30px rgba(79,158,255,0.22); }
    code { background: rgba(255,255,255,0.08); padding: 0.28rem 0.55rem; border-radius: 0.45rem; color: #d1e7ff; font-size: 0.95rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); color: #9bb7ff; font-size: 0.95rem; }
    .status { margin: 1rem 0 0; font-size: 0.95rem; color: #cbd7ff; }
    .small { color: #c7d6ff; }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div>
        <p class="lead">OTTKing SonyLiv server worker শুধু আপনার গোপন সার্ভার URL ব্যবহার করে স্ট্রিম মোড়ক করে দেয়।</p>
        <h1>OTTKing SonyLiv Proxy</h1>
      </div>
    </header>
    <div class="card">
      <h2>How to use</h2>
      <p>এখানে আপনি আপনার চ্যানেল প্লেয়ার পেজ এবং লুকানো প্রোক্সি এন্ডপয়েন্ট দুইটি ভিন্ন ভাবে খুলতে পারেন।</p>
      <div class="links">
        <a class="button" href="/sony_ten4/index.m3u8">Open sample channel page</a>
        <a class="button" href="/hidden/sony_ten4">Open hidden proxy</a>
      </div>
      <p class="status">Example stream page: <code>/sony_ten4/index.m3u8</code><br />Hidden proxy endpoint: <code>/hidden/sony_ten4</code></p>
    </div>
    <div class="card">
      <h2>Server details</h2>
      <p>এই ওয়ার্কারটি হার্ডকোড করা <code>API_BASE</code> এবং <code>PROXY_BASE</code> ব্যবহার করে।</p>
      <p class="small">চ্যানেলের নাম যেমন: <code>sony_ten4</code>, এবং আপনি <code>?channel=sony_ten4</code> দিয়ে স্ট্রিম প্রোক্সি করতে পারবেন।</p>
    </div>
    <div class="footer">
      <p>Designed for OTTKing SonyLiv server. Use the root page for quick access and the hidden proxy for actual stream delivery.</p>
    </div>
  </div>
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
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #091021 0%, #03050b 70%, #000 100%); color: #f8fbff; font-family: Inter, system-ui, sans-serif; }
    .player-shell { width: min(100%, 980px); padding: 1.25rem; }
    .player-card { border-radius: 28px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 30px 80px rgba(0,0,0,0.30); overflow: hidden; }
    .header { padding: 1.4rem 1.6rem; display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; justify-content: space-between; }
    .header h1 { margin: 0; font-size: clamp(1.4rem, 2vw, 2.1rem); }
    .header a { color: #7ed8ff; text-decoration: none; font-weight: 600; }
    #player { width: 100%; height: 56vw; max-height: 560px; background: #000; }
    .meta { padding: 1.4rem 1.6rem; color: #d7e7ff; line-height: 1.7; }
    .meta code { background: rgba(255,255,255,0.08); padding: 0.2rem 0.45rem; border-radius: 0.45rem; }
    .note { margin-top: 1rem; color: #a8caff; }
  </style>
</head>
<body>
  <div class="player-shell">
    <div class="player-card">
      <div class="header">
        <div>
          <h1>${channel} প্লেয়ার</h1>
          <p class="note">Stream loaded through hidden proxy endpoint.</p>
        </div>
        <a href="${streamUrl}">View source</a>
      </div>
      <video id="player" controls autoplay playsinline muted></video>
      <div class="meta">
        <p>আপনার চ্যানেলকে প্লে করতে নিচের লিংক ব্যবহার করা হচ্ছে:</p>
        <p><code>${streamUrl}</code></p>
      </div>
    </div>
  </div>
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
      document.body.innerHTML = '<p style="color:#f66; text-align:center; padding:2rem;">এই ব্রাউজারে HLS প্লে করতে পারে না।</p>';
    }
  </script>
</body>
</html>`;
}
