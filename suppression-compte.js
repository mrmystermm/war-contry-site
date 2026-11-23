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
    if (!token) { location.replace("connexion.html"); return; }
    try {
      const response = await fetch(API + "/me", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error("Session expirée. Reconnecte-toi.");
    } catch {
      localStorage.removeItem("wc_account_token");
      location.replace("connexion.html");
      return;
    }
    $("delete-account-form").addEventListener("submit", async event => {
      event.preventDefault();
      const password = $("delete-password").value;
      const confirmation = $("delete-confirmation").value;
      if (confirmation !== "SUPPRIMER") {
        show("Saisis exactement SUPPRIMER pour continuer.", "error");
        return;
      }
      if (!$("delete-acknowledge").checked) {
        show("Coche la case pour confirmer que tu comprends le caractère définitif de cette action.", "error");
        return;
      }
      const button = $("request-deletion");
      button.disabled = true;
      show("Envoi de la demande…");
      try {
        const response = await fetch(API + "/request-account-deletion", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ password, confirmation })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Impossible d'envoyer la demande.");
        $("delete-account-form").hidden = true;
        show(data.message || "Consulte ta boîte e-mail pour confirmer la suppression.", "ok");
      } catch (error) {
        show(error.message || "Une erreur est survenue. Réessaie.", "error");
        button.disabled = false;
      }
    });
  });
})();