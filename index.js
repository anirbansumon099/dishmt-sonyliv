export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let channel = url.searchParams.get("channel"); // এখানে শুধু চ্যানেলের নাম দিবেন

    // সাপোর্ট: /hidden/<channel> পাথ থেকে চ্যানেল নেয়ার সুবিধা
    const pathname = url.pathname || "/";
    if (!channel && pathname.startsWith("/hidden/")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) channel = parts[1];
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
