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
    const button = $("confirm-email-action");
    if (!token) {
      button.hidden = true;
      show("Lien de confirmation manquant. Vérifie le lien reçu par e-mail.", "error");
      return;
    }
    button.addEventListener("click", async () => {
      button.disabled = true;
      show("Confirmation en cours…");
      try {
        const response = await fetch(API + "/confirm-email-change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Impossible de confirmer cette adresse.");
        button.hidden = true;
        show("Ton adresse e-mail a bien été modifiée. Retour aux paramètres du compte…", "ok");
        setTimeout(() => location.replace("mon-compte.html"), 1800);
      } catch (error) {
        show(error.message || "Une erreur est survenue.", "error");
        button.disabled = false;
      }
    });
  });
})();