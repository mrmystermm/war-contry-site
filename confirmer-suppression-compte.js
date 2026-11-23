(() => {
  const API = "https://warcontry-accounts.mr-mystermm.workers.dev";
  const $ = id => document.getElementById(id);
  const token = new URLSearchParams(location.search).get("token") || "";
  const show = (message, type = "") => {
    const notice = $("notice");
    notice.textContent = message;
    notice.className = "notice " + type;
  };
  document.addEventListener("DOMContentLoaded", () => {
    const button = $("confirm-deletion");
    if (!token || token.length > 200) {
      button.disabled = true;
      show("Le lien de confirmation est manquant ou invalide. Recommence la demande depuis ton compte.", "error");
      return;
    }
    button.addEventListener("click", async () => {
      button.disabled = true;
      show("Suppression en cours…");
      try {
        const response = await fetch(API + "/confirm-account-deletion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Impossible de supprimer le compte.");
        localStorage.removeItem("wc_account_token");
        button.hidden = true;
        const links = document.querySelector(".auth-links");
        if (links) links.hidden = true;
        show(data.message || "Ton compte a été supprimé définitivement.", "ok");
        window.history.replaceState({}, document.title, location.pathname);
        window.setTimeout(() => location.replace("index.html"), 3500);
      } catch (error) {
        show(error.message || "Une erreur est survenue. Réessaie.", "error");
        button.disabled = false;
      }
    });
  });
})();