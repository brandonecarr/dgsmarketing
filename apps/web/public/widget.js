/*! Rosie embed widget — chat / click-to-text / review-request.
 *
 * Usage on an operator's site:
 *
 *   <script async src="https://app.example.com/widget.js"
 *           data-rosie-tenant="acme-plumbing"
 *           data-rosie-mode="chat"></script>
 *
 * Modes:
 *   chat   — floating button + popup form, POSTs to /api/webhooks/leads/<slug>
 *   text   — opens sms: deep-link with the tenant's SMS number
 *   review — opens the tenant's Google review URL (or shows internal feedback form first)
 *
 * Optional data-rosie-color="#hex" overrides the tenant's brand color.
 */
(function () {
  if (window.__rosieEmbedLoaded) return;
  window.__rosieEmbedLoaded = true;

  var script = document.currentScript ||
    Array.prototype.slice.call(document.scripts).find(function (s) {
      return s.src && s.src.indexOf("/widget.js") !== -1;
    });
  if (!script) return;

  var tenant = script.getAttribute("data-rosie-tenant");
  var mode = script.getAttribute("data-rosie-mode") || "chat";
  var colorOverride = script.getAttribute("data-rosie-color");
  var labelOverride = script.getAttribute("data-rosie-label");
  if (!tenant) {
    console.error("[Rosie] widget needs data-rosie-tenant on the <script> tag");
    return;
  }

  // Resolve the API host from the script's own src so the widget always
  // calls back to wherever the script was loaded from.
  var origin = new URL(script.src).origin;

  var cfg = null;
  fetch(origin + "/api/embed/config/" + encodeURIComponent(tenant))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      cfg = data;
      if (!cfg) return;
      if (colorOverride) cfg.primaryColor = colorOverride;
      mount();
    })
    .catch(function () { /* network or 404 — fail silently, don't break the host page */ });

  function mount() {
    if (mode === "text") return mountTextWidget();
    if (mode === "review") return mountReviewWidget();
    mountChatWidget();
  }

  // ---------- Shared style + DOM helpers ----------

  function injectStyles() {
    if (document.getElementById("rosie-embed-styles")) return;
    var style = document.createElement("style");
    style.id = "rosie-embed-styles";
    style.textContent = [
      ".rosie-embed { position: fixed; z-index: 2147483646; bottom: 20px; right: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
      ".rosie-embed * { box-sizing: border-box; }",
      ".rosie-embed-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border: 0; border-radius: 999px; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.18); }",
      ".rosie-embed-btn:hover { filter: brightness(1.08); }",
      ".rosie-embed-panel { position: fixed; bottom: 80px; right: 20px; width: 340px; max-width: calc(100vw - 40px); background: #fff; color: #0b0b14; border-radius: 16px; box-shadow: 0 18px 48px rgba(0,0,0,0.22); overflow: hidden; }",
      ".rosie-embed-panel-h { padding: 16px 18px; color: #fff; }",
      ".rosie-embed-panel-h .ttl { font-weight: 800; font-size: 16px; }",
      ".rosie-embed-panel-h .sub { font-size: 12px; opacity: 0.85; }",
      ".rosie-embed-panel-b { padding: 14px 18px 18px; }",
      ".rosie-embed-field { display: flex; flex-direction: column; margin-bottom: 10px; }",
      ".rosie-embed-field > span { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #555; margin-bottom: 4px; }",
      ".rosie-embed-field input, .rosie-embed-field textarea { border: 1px solid #d4d4d8; border-radius: 8px; padding: 9px 10px; font-size: 14px; font: inherit; outline: 0; }",
      ".rosie-embed-field input:focus, .rosie-embed-field textarea:focus { border-color: var(--rosie-primary, #5b21b6); box-shadow: 0 0 0 2px rgba(91,33,182,0.15); }",
      ".rosie-embed-submit { width: 100%; padding: 11px 14px; border: 0; border-radius: 8px; background: var(--rosie-primary, #5b21b6); color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }",
      ".rosie-embed-submit:disabled { opacity: 0.6; cursor: progress; }",
      ".rosie-embed-consent { display: flex; gap: 8px; padding: 8px 10px; background: #f6f6fa; border: 1px solid #e5e5ea; border-radius: 8px; font-size: 11px; color: #555; line-height: 1.45; margin-bottom: 10px; }",
      ".rosie-embed-close { position: absolute; top: 10px; right: 12px; width: 26px; height: 26px; border: 0; border-radius: 999px; background: rgba(255,255,255,0.18); color: #fff; cursor: pointer; font-size: 14px; line-height: 1; }",
      ".rosie-embed-success { padding: 16px 0; text-align: center; color: #16a34a; font-weight: 600; font-size: 14px; }",
      ".rosie-embed-foot { margin-top: 8px; text-align: center; font-size: 10px; color: #888; }",
      ".rosie-embed-foot a { color: #888; text-decoration: underline; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "style") n.setAttribute("style", attrs[k]);
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function rootWrap() {
    var w = document.createElement("div");
    w.className = "rosie-embed";
    w.style.setProperty("--rosie-primary", cfg.primaryColor);
    document.body.appendChild(w);
    return w;
  }

  // ---------- Chat widget ----------

  function mountChatWidget() {
    injectStyles();
    var root = rootWrap();
    var panel = null;

    var btn = el("button", {
      class: "rosie-embed-btn",
      style: "background:" + cfg.primaryColor,
      "aria-label": "Open chat",
      onclick: function () {
        if (panel) { panel.remove(); panel = null; return; }
        panel = renderChatPanel();
        root.appendChild(panel);
      },
    }, [labelOverride || ("Message " + cfg.displayName)]);
    root.appendChild(btn);
  }

  function renderChatPanel() {
    var p = el("div", { class: "rosie-embed-panel" });
    var head = el("div", {
      class: "rosie-embed-panel-h",
      style: "background:" + cfg.primaryColor,
    }, [
      el("div", { class: "ttl" }, ["Send us a message"]),
      el("div", { class: "sub" }, [cfg.displayName + " · we usually reply in minutes"]),
    ]);
    head.appendChild(el("button", {
      class: "rosie-embed-close",
      "aria-label": "Close",
      onclick: function () { p.remove(); },
    }, ["×"]));
    p.appendChild(head);

    var body = el("div", { class: "rosie-embed-panel-b" });
    var form = el("form", {
      onsubmit: function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var payload = {
          name: fd.get("name"),
          phone: fd.get("phone"),
          email: fd.get("email"),
          source: "web_form",
          metadata: { embed: true, host: location.hostname },
          smsConsent: fd.get("smsConsent") === "1" ? "1" : undefined,
        };
        var submit = form.querySelector(".rosie-embed-submit");
        submit.disabled = true;
        submit.textContent = "Sending…";
        fetch(origin + cfg.leadEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(function (r) {
          if (!r.ok) throw new Error("send_failed");
          body.innerHTML = "<div class=\"rosie-embed-success\">Thanks! We'll be in touch shortly.</div>";
          setTimeout(function () { p.remove(); }, 2500);
        }).catch(function () {
          submit.disabled = false;
          submit.textContent = "Send";
          alert("Couldn't send right now — please try again.");
        });
      },
    });

    form.appendChild(field("name", "Your name", "text", true));
    form.appendChild(field("phone", "Phone", "tel", true));
    form.appendChild(field("email", "Email (optional)", "email", false));

    var consent = el("label", { class: "rosie-embed-consent" });
    var cb = el("input", { type: "checkbox", name: "smsConsent", value: "1", required: "required" });
    consent.appendChild(cb);
    consent.appendChild(el("span", {}, [
      "I agree to receive SMS from " + cfg.displayName +
        " about my inquiry. Msg & data rates apply. Reply STOP to unsubscribe.",
    ]));
    form.appendChild(consent);

    form.appendChild(el("button", { type: "submit", class: "rosie-embed-submit" }, ["Send"]));
    body.appendChild(form);

    var foot = el("div", { class: "rosie-embed-foot", html: "Powered by Rosie" });
    body.appendChild(foot);

    p.appendChild(body);
    return p;
  }

  function field(name, label, type, required) {
    var wrap = el("label", { class: "rosie-embed-field" });
    wrap.appendChild(el("span", {}, [label]));
    var attrs = { name: name, type: type };
    if (required) attrs.required = "required";
    wrap.appendChild(el("input", attrs));
    return wrap;
  }

  // ---------- Click-to-text widget ----------

  function mountTextWidget() {
    injectStyles();
    if (!cfg.smsNumber) return; // No SMS line on file — nothing to mount.
    var root = rootWrap();
    var label = labelOverride || ("Text " + cfg.displayName);
    var prefill = encodeURIComponent("Hi — I saw your site and want a quote.");
    var href = "sms:" + cfg.smsNumber.replace(/[^+\d]/g, "") + (/Android/i.test(navigator.userAgent) ? "?body=" : "&body=") + prefill;
    var btn = el("a", {
      class: "rosie-embed-btn",
      href: href,
      style: "background:" + cfg.primaryColor + ";text-decoration:none",
    }, [label]);
    root.appendChild(btn);
  }

  // ---------- Review-request widget ----------

  function mountReviewWidget() {
    injectStyles();
    if (!cfg.reviewUrl) return;
    var root = rootWrap();
    var panel = null;

    var btn = el("button", {
      class: "rosie-embed-btn",
      style: "background:" + cfg.primaryColor,
      onclick: function () {
        if (panel) { panel.remove(); panel = null; return; }
        panel = renderReviewPanel();
        root.appendChild(panel);
      },
    }, [labelOverride || "⭐ Leave a review"]);
    root.appendChild(btn);
  }

  function renderReviewPanel() {
    var p = el("div", { class: "rosie-embed-panel" });
    var head = el("div", {
      class: "rosie-embed-panel-h",
      style: "background:" + cfg.primaryColor,
    }, [
      el("div", { class: "ttl" }, ["How was your experience?"]),
      el("div", { class: "sub" }, ["A quick 5-star review means a lot to " + cfg.displayName + "."]),
    ]);
    head.appendChild(el("button", {
      class: "rosie-embed-close",
      onclick: function () { p.remove(); },
    }, ["×"]));
    p.appendChild(head);

    var body = el("div", { class: "rosie-embed-panel-b" });
    var row = el("div", { style: "display:flex;gap:4px;justify-content:center;margin:8px 0 14px;" });
    [1, 2, 3, 4, 5].forEach(function (star) {
      var b = el("button", {
        type: "button",
        style: "background:none;border:0;font-size:32px;cursor:pointer;line-height:1;",
        onclick: function () {
          if (star >= 4) {
            window.open(cfg.reviewUrl, "_blank", "noopener");
            p.remove();
          } else {
            renderFeedback(body, star);
          }
        },
      }, ["☆"]);
      b.addEventListener("mouseenter", function () { b.textContent = "★"; });
      b.addEventListener("mouseleave", function () { b.textContent = "☆"; });
      row.appendChild(b);
    });
    body.appendChild(row);
    body.appendChild(el("p", {
      style: "font-size:12px;color:#666;text-align:center;line-height:1.5;margin:0",
    }, ["4★ or 5★ → Google. Anything lower → tell us privately so we can make it right."]));
    p.appendChild(body);
    return p;
  }

  function renderFeedback(body, stars) {
    body.innerHTML = "";
    var msg = el("p", { style: "font-size:13px;line-height:1.5;color:#333;margin:0 0 10px" }, [
      "Sorry to hear that. Drop us a note and we'll look into it personally.",
    ]);
    body.appendChild(msg);
    var form = el("form", {
      onsubmit: function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        fetch(origin + cfg.leadEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fd.get("name") || undefined,
            email: fd.get("email") || undefined,
            phone: fd.get("phone") || undefined,
            source: "web_form",
            metadata: { embed: "review", stars: stars, feedback: fd.get("feedback") },
          }),
        }).catch(function () { /* swallow */ });
        body.innerHTML = "<div class=\"rosie-embed-success\">Thanks for the feedback.</div>";
      },
    });
    form.appendChild(field("email", "Your email", "email", false));
    form.appendChild((function () {
      var w = el("label", { class: "rosie-embed-field" });
      w.appendChild(el("span", {}, ["What happened?"]));
      w.appendChild(el("textarea", { name: "feedback", rows: "3", required: "required" }));
      return w;
    })());
    form.appendChild(el("button", { type: "submit", class: "rosie-embed-submit" }, ["Send"]));
    body.appendChild(form);
  }
})();
