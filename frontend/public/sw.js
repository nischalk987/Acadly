/* Acadly service worker: display already-authorized Web Push payloads. */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "" }; }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "Acadly reminder";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a study reminder.",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    renotify: false,
    data: { url: typeof payload.url === "string" ? payload.url : "/" },
    icon: "/favicon.ico",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== target) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
