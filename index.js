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
  <title>OTTKing SonyLiv Server</title>
  <style>
    body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, sans-serif; background: radial-gradient(circle at top, #0f2a60, #040614 55%, #02020a 100%); color: #f9fbff; }
    .page { max-width: 1040px; margin: 0 auto; padding: 2rem; }
    header { display: grid; gap: 1rem; padding: 2rem 0 1.5rem; }
    h1 { margin: 0; font-size: clamp(2.8rem, 5vw, 4.2rem); line-height: 1.02; letter-spacing: -0.06em; }
    p.lead { margin: 0; color: #b9d6ff; font-size: 1.12rem; line-height: 1.8; }
    .hero { display: grid; gap: 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 1.8rem; box-shadow: 0 30px 80px rgba(0,0,0,0.45); }
    .hero strong { color: #80baff; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-top: 1.5rem; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 1.4rem; backdrop-filter: blur(16px); }
    .card h2 { margin-top: 0; color: #edf3ff; }
    .card p { color: #c1d4ff; margin: 0.75rem 0 0; line-height: 1.7; }
    .button { display: inline-flex; align-items: center; justify-content: center; gap: 0.55rem; padding: 0.95rem 1.4rem; border-radius: 999px; border: none; color: white; background: linear-gradient(135deg, #4b8bff, #8ed1ff); text-decoration: none; font-weight: 700; box-shadow: 0 18px 40px rgba(54, 95, 168, 0.25); }
    .footer { margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; color: #9db8f4; font-size: 0.95rem; }
    code { display: inline-block; background: rgba(255,255,255,0.08); padding: 0.22rem 0.45rem; border-radius: 0.45rem; font-size: 0.96rem; }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div>
        <p class="lead">OTTKing SonyLiv server proxy worker এখন মূল ট্রাফিক রাখতে পারে `?channel=` রুট ব্যবহার করে, আর একই সাথে একটি সুন্দর ল্যান্ডিং পেজ দেখায়।</p>
        <h1>OTTKing SonyLiv Server</h1>
      </div>
    </header>

    <div class="hero">
      <p>রুট পেজে `index.html` ডিজাইন ডাউনলোড করার মতো লুকিং ইন্টারফেস পাবেন। আপনার এসি পাথ `/?channel=<strong>channel_name</strong>` দিয়ে সটান হেডারে মোড়ে নিয়ে যাবে।</p>
      <div class="grid">
        <div class="card">
          <h2>Proxy route</h2>
          <p>পুরাতন স্বাভাবিক আচরণ ধরে থাকবে। শুধু `https://<your-worker>/?channel=sony_ten4` দিয়ে কাজ করবেন।</p>
        </div>
        <div class="card">
          <h2>Channel page</h2>
          <p>ওয়েব প্লেয়ার পেজ পাবেন `https://<your-worker>/sony_ten4/index.m3u8` এই ফরম্যাটে।</p>
        </div>
        <div class="card">
          <h2>Design</h2>
          <p>OTTKing SonyLiv থিমে সুন্দর ডিজাইন, ব্র্যান্ড স্টাইল এবং রেস্পনসিভ লেআউট।</p>
        </div>
      </div>

      <div style="margin-top:1.5rem; display:flex; flex-wrap:wrap; gap:0.85rem;">
        <a class="button" href="/sony_ten4/index.m3u8">Sony Ten 4 Player</a>
        <a class="button" href="/?channel=sony_ten4">Direct Proxy</a>
      </div>
    </div>

    <div class="footer">
      <p>এই সার্ভারটি `<code>API_BASE</code>` ও `<code>PROXY_BASE</code>` সিক্রেট থেকে কাজ করে, তাই সোর্সে আপনার আসল সার্ভার ইউআরএল দেখাবে না।</p>
    </div>
  </div>
</body>
</html>`;
}

function getChannelHtml(channel, origin) {
  const streamUrl = `${origin}/?channel=${encodeURIComponent(channel)}`;
  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OTTKing SonyLiv • ${channel}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #090f19, #020206 70%); color: #f5faff; font-family: Inter, system-ui, sans-serif; }
    .player-frame { width: min(100%, 980px); padding: 1.4rem; border-radius: 28px; background: rgba(18, 24, 48, 0.95); box-shadow: 0 30px 80px rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); }
    .title { margin: 0 0 1rem; font-size: clamp(1.6rem, 3vw, 2.3rem); }
    .subtitle { margin: 0 0 1rem; color: #9bb8ff; }
    video { width: 100%; height: 56vw; max-height: 560px; border-radius: 18px; background: #000; }
    .note { margin-top: 1rem; color: #cbd7ff; font-size: 0.97rem; line-height: 1.7; }
    .back { display: inline-flex; align-items: center; gap: 0.55rem; margin-top: 1.3rem; color: #9dd7ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="player-frame">
    <h1 class="title">OTTKing SonyLiv • ${channel}</h1>
    <p class="subtitle">Stream loaded through the normal query proxy: <code>?channel=${channel}</code></p>
    <video id="player" controls autoplay playsinline muted></video>
    <p class="note">এই প্লেয়ারটি HLS.js ব্যবহার করে. যদি ব্লক না হয়, এটি স্বয়ংক্রিয়ভাবে স্ট্রিম প্লে করবে।</p>
    <a class="back" href="/">← Back to OTTKing home</a>
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
      document.body.innerHTML = '<p style="color:#f66; padding: 2rem;">এই ব্রাউজারে HLS প্লে করতে পারে না।</p>';
    }
  </script>
</body>
</html>`;
}
