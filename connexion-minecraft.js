const MINECRAFT_API = "https://warcontry-accounts.mr-mystermm.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("wc_account_token");
  const notice = document.getElementById("minecraft-link-notice");
  const button = document.getElementById("minecraft-link-submit");
  const input = document.getElementById("minecraft-link-code");
  const linkedAccount = document.getElementById("minecraft-linked-account");

  if (!token) {
    location.href = "connexion.html";
    return;
  }

  function showNotice(message, type = "") {
    notice.textContent = message;
    notice.className = type ? "notice " + type : "notice";
  }

  async function loadLinkStatus() {
    try {
      const response = await fetch(MINECRAFT_API + "/minecraft-link-status", {
        headers: { Authorization: "Bearer " + token }
      });
      const result = await response.json();
      if (response.status === 401) {
        localStorage.removeItem("wc_account_token");
        location.href = "connexion.html";
        return;
      }
      if (!response.ok || !result.ok) throw new Error(result.error || "Impossible de vérifier la liaison.");
      if (result.linked) {
        linkedAccount.textContent = result.linked.username + " — compte Minecraft associé.";
        input.disabled = true;
        button.disabled = true;
        button.textContent = "Compte déjà lié";
        showNotice("Ton compte Minecraft est bien associé à ton compte War Contry.");
      } else {
        linkedAccount.textContent = "Aucun compte Minecraft lié pour le moment.";
      }
    } catch (error) {
      showNotice(error.message || "Erreur lors du chargement.", "error");
    }
  }

  button.addEventListener("click", async () => {
    const code = input.value.trim();
    if (!/^\d{8}$/.test(code)) {
      showNotice("Saisis le code à 8 chiffres affiché en jeu.", "error");
      return;
    }

    button.disabled = true;
    showNotice("Vérification du code en cours…");
    try {
      const response = await fetch(MINECRAFT_API + "/minecraft-link-redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ code })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "La liaison a échoué.");
      linkedAccount.textContent = result.linked.username + " — compte Minecraft associé.";
      input.disabled = true;
      button.textContent = "Compte lié";
      showNotice("Ton compte Minecraft est maintenant associé à ton compte War Contry.");
    } catch (error) {
      showNotice(error.message || "Erreur lors de la liaison.", "error");
      button.disabled = false;
    }
  });

  await loadLinkStatus();
});