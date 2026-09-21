/**
 * Foreground notifications: when a signed-in user turns this on, the app
 * (a) asks the browser for Notification permission, (b) saves the
 * preference to their profile row, and (c) opens a Supabase Realtime
 * subscription on the blog_posts table so a native notification pops up
 * the moment someone publishes — while this tab is open.
 *
 * IMPORTANT LIMITATION: this is foreground-only. True "notify me even when
 * the site is closed" push requires a service worker + the Web Push API
 * with VAPID keys and a push subscription table — real, buildable on
 * Supabase (Edge Functions can send the push), but it's a separate project
 * from this client-only demo. See README § Notifications for the next step.
 */
const MI_NOTIFY = (() => {
  let channel = null;

  function supported() { return "Notification" in window; }

  async function enable(userId) {
    if (!supported()) return { ok: false, error: "This browser doesn't support notifications." };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, error: "Notification permission was not granted." };
    await MI_DB.setNotificationsEnabled(userId, true);
    startListening();
    return { ok: true };
  }

  async function disable(userId) {
    await MI_DB.setNotificationsEnabled(userId, false);
    stopListening();
    return { ok: true };
  }

  function startListening() {
    if (!MI_SUPABASE.ready || channel) return;
    channel = MI_SUPABASE.client
      .channel("public:blog_posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "blog_posts" }, (payload) => {
        const post = payload.new;
        if (!post.published) return;
        if (Notification.permission === "granted") {
          const n = new Notification("New on Marvel India", { body: post.title, tag: post.id });
          n.onclick = () => { window.focus(); location.hash = `#/blog/${post.slug}`; };
        }
      })
      .subscribe();
  }

  function stopListening() {
    if (channel) { MI_SUPABASE.client.removeChannel(channel); channel = null; }
  }

  return { supported, enable, disable, startListening, stopListening };
})();
