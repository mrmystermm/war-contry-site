(() => {
  const API = "https://warcontry-accounts.mr-mystermm.workers.dev";
  const token = localStorage.getItem("wc_account_token");
  if (!token) return;
  fetch(API + "/preferences", { headers: { Authorization: "Bearer " + token }, cache: "no-store" })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ok,data}) => {
      if (!ok || !data.ok || !data.preferences) return;
      document.documentElement.dataset.theme = data.preferences.theme;
      document.documentElement.lang = data.preferences.language;
      window.wcPreferences = data.preferences;
      window.dispatchEvent(new CustomEvent("wc-preferences-loaded", { detail: data.preferences }));
    }).catch(() => {});
})();
