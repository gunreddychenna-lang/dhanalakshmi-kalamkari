/**
 * =========================================================================
 * DHANALAKSHMI KALAMKARI - CRM VISITOR & INTENT TRACKER
 * =========================================================================
 */
(function () {
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyKfSjWXuTmsRcGJ4gjN5pV3WMne1ELnBcPCKGIf733NPv08ac9FEePW9oIktUynpP9Jg/exec";

  function getVisitorInfo() {
    let visitorId = localStorage.getItem("crm_visitor_id") || localStorage.getItem("kalamkari_crm_vid");
    let visitorType = "Returning";

    if (!visitorId) {
      visitorType = "New";
      visitorId =
        "visitor-" +
        Math.random().toString(36).substring(2, 10) +
        "-" +
        Math.random().toString(36).substring(2, 8);
      localStorage.setItem("crm_visitor_id", visitorId);
      localStorage.setItem("kalamkari_crm_vid", visitorId);
    }

    return { visitorId, visitorType };
  }

  function isBotTraffic() {
    const userAgent = navigator.userAgent || "";
    const botPattern = /(bot|googlebot|crawler|spider|robot|crawling|lighthouse|headlesschrome)/i;
    return botPattern.test(userAgent);
  }

  function getTrafficSource() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get("utm_source");

    if (utmSource) return utmSource;

    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        if (refUrl.hostname.includes("instagram.com")) return "ig";
        if (refUrl.hostname.includes("facebook.com") || refUrl.hostname.includes("fb.com")) return "fb";
        if (refUrl.hostname.includes("chatgpt.com")) return "chatgpt.com";
        if (refUrl.hostname.includes("google.com")) return "google";
        if (!refUrl.hostname.includes(window.location.hostname)) return refUrl.hostname;
      } catch (e) {
        return "other website";
      }
    }

    return "direct / organic";
  }

  function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "Samsung Browser";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Edge") || ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Google Chrome";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return "Google Chrome";
  }

  function sendToWebhook(payload) {
    if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith("http")) return;

    try {
      const blobPayload = new Blob([JSON.stringify(payload)], {
        type: "text/plain;charset=UTF-8"
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(WEBHOOK_URL, blobPayload);
      } else {
        fetch(WEBHOOK_URL, {
          method: "POST",
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  }

  async function logInitialTraffic() {
    const { visitorId, visitorType } = getVisitorInfo();
    const isBot = isBotTraffic();

    let city = "Unknown";
    let region = "Unknown";
    let country = "India";
    let ip = "Anonymized";

    // Silent Catch to avoid ipwho.is 429 rate-limiting console errors
    try {
      const geoRes = await fetch("https://get.geojs.io/v1/ip/geo.json");
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        city = geoData.city || "Unknown";
        region = geoData.region || "Unknown";
        country = geoData.country || "India";
        ip = geoData.ip || "Anonymized";
      }
    } catch (e) {
      // Quiet failover
    }

    const payload = {
      action: "logTraffic",
      isBot: isBot,
      timestamp: new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }).replace(",", ""),
      visitorId: visitorId,
      visitorType: visitorType,
      source: getTrafficSource(),
      browser: getBrowserName(),
      city: city,
      region: region,
      country: country,
      ip: ip,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent || "Mozilla/5.0"
    };

    sendToWebhook(payload);
  }

  let startTime = Date.now();
  let totalActiveTimeMs = 0;
  let isTabVisible = !document.hidden;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (isTabVisible) {
        totalActiveTimeMs += Date.now() - startTime;
        isTabVisible = false;
      }
    } else {
      if (!isTabVisible) {
        startTime = Date.now();
        isTabVisible = true;
      }
    }
  });

  function getProductDetails() {
    const hash = window.location.hash || "";
    let productCode = "N/A";
    let productTitle = "Browsing Main Catalogue";

    if (hash.includes("kalamkari") || hash.startsWith("#product/")) {
      const match = hash.match(/(?:[A-Za-z0-9_-]+-)?([A-Za-z0-9]+)$/);
      if (match && match[1]) {
        productCode = match[1];
      }
    }

    const detailTitleEl = document.getElementById("detail-title");
    if (detailTitleEl && detailTitleEl.textContent.trim()) {
      productTitle = detailTitleEl.textContent.trim();
    }

    return { productCode, productTitle };
  }

  let sessionFlushed = false;

  function flushActiveSession() {
    if (sessionFlushed) return;

    if (isTabVisible) {
      totalActiveTimeMs += Date.now() - startTime;
    }

    const durationSeconds = Math.round(totalActiveTimeMs / 1000);
    if (durationSeconds < 2) return;

    sessionFlushed = true;

    const { visitorId, visitorType } = getVisitorInfo();
    const { productCode, productTitle } = getProductDetails();
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const formattedTime = `${minutes}m ${seconds}s`;

    const payload = {
      action: "logTimeSpent",
      isBot: isBotTraffic(),
      timestamp: new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }).replace(",", ""),
      visitorId: visitorId,
      visitorType: visitorType,
      productTitle: productTitle,
      productCode: productCode,
      durationFormatted: formattedTime,
      durationSeconds: durationSeconds,
      pageUrl: window.location.href
    };

    sendToWebhook(payload);
  }

  window.addEventListener("hashchange", function () {
    flushActiveSession();
    sessionFlushed = false;
    startTime = Date.now();
    totalActiveTimeMs = 0;
  });

  window.addEventListener("pagehide", flushActiveSession);
  window.addEventListener("beforeunload", flushActiveSession);

  if (document.readyState === "complete" || document.readyState === "interactive") {
    logInitialTraffic();
  } else {
    document.addEventListener("DOMContentLoaded", logInitialTraffic);
  }
})();