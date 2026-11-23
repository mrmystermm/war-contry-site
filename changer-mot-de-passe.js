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
    } catch {
      localStorage.removeItem("wc_account_token");
      location.replace("connexion.html");
      return;
    }
    $("password-form").addEventListener("submit", async event => {
      event.preventDefault();
      const currentPassword = $("current-password").value;
      const newPassword = $("new-password").value;
      const confirmPassword = $("confirm-password").value;
      const button = $("save-password");
      if (newPassword.length < 12 || newPassword.length > 128) {
        show("Le nouveau mot de passe doit contenir entre 12 et 128 caractères.", "error");
        return;
      }
      if (newPassword !== confirmPassword) {
        show("Les deux nouveaux mots de passe ne correspondent pas.", "error");
        return;
      }
      button.disabled = true;
      show("Modification en cours…");
      try {
        const response = await fetch(API + "/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Impossible de modifier le mot de passe.");
        $("password-form").hidden = true;
        show(data.message || "Ton mot de passe a été modifié.", "ok");
        $("current-password").value = "";
        $("new-password").value = "";
        $("confirm-password").value = "";
      } catch (error) {
        show(error.message || "Une erreur est survenue. Réessaie.", "error");
        button.disabled = false;
      }
    });
  });
})();