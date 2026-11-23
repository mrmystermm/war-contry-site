(() => {
  const API = "https://warcontry-accounts.mr-mystermm.workers.dev";
  const $ = id => document.getElementById(id);
  const show = (message, type = "") => {
    const notice = $("notice");
    notice.textContent = message;
    notice.className = "notice " + type;
  };
  document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("wc_account_token");
    if (!token) {
      location.replace("connexion.html");
      return;
    }
    try {
      const response = await fetch(API + "/me", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Session expirée. Reconnecte-toi.");
      $("current-username").textContent = data.account.username;
      $("new-username").value = data.account.username;
    } catch (error) {
      if (error.message.includes("Session expirée")) {
        localStorage.removeItem("wc_account_token");
        location.replace("connexion.html");
        return;
      }
      show("Impossible de charger ton compte. Vérifie ta connexion puis actualise la page.", "error");
    }
    $("username-form").addEventListener("submit", async event => {
      event.preventDefault();
      const username = $("new-username").value.trim();
      const currentPassword = $("current-password").value;
      const button = $("save-username");
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
        show("Le pseudo doit contenir de 3 à 16 lettres, chiffres ou underscores.", "error");
        return;
      }
      button.disabled = true;
      show("Modification en cours…");
      try {
        const response = await fetch(API + "/username", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ username, currentPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Impossible de modifier le pseudo.");
        $("current-username").textContent = data.account.username;
        $("new-username").value = data.account.username;
        $("current-password").value = "";
        show(data.message || "Ton pseudo a bien été modifié. Retour aux paramètres…", "ok");
        button.disabled = true;
        setTimeout(() => location.assign("mon-compte.html"), 1200);
      } catch (error) {
        show(error.message || "Une erreur est survenue. Réessaie.", "error");
        button.disabled = false;
      }
    });
  });
})();