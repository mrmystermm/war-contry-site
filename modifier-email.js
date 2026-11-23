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
      if (!response.ok || !data.ok) throw new Error("Session expirée. Reconnecte-toi.");
      $("current-email").textContent = data.account.email;
    } catch {
      localStorage.removeItem("wc_account_token");
      location.replace("connexion.html");
      return;
    }
    $("email-form").addEventListener("submit", async event => {
      event.preventDefault();
      const email = $("new-email").value.trim();
      const currentPassword = $("current-password").value;
      const button = $("save-email");
      button.disabled = true;
      show("Envoi de la demande…");
      try {
        const response = await fetch(API + "/request-email-change", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ email, currentPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Impossible d'envoyer la demande.");
        $("current-password").value = "";
        $("email-form").hidden = true;
        show(data.message || "Un lien de confirmation vient d'être envoyé à ta nouvelle adresse.", "ok");
      } catch (error) {
        show(error.message || "Une erreur est survenue. Réessaie.", "error");
        button.disabled = false;
      }
    });
  });
})();