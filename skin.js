const SKIN_API = "https://warcontry-accounts.mr-mystermm.workers.dev";
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("wc_account_token");
  const input = document.getElementById("skin-file");
  const button = document.getElementById("skin-upload");
  const notice = document.getElementById("skin-notice");
  const front = document.getElementById("skin-front");
  const back = document.getElementById("skin-back");
  if (!token) { location.href = "connexion.html"; return; }

  function message(text, type = "") {
    notice.textContent = text;
    notice.className = type ? "notice " + type : "notice";
  }
  function clearCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101d30";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function drawSkin(image) {
    function part(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
      ctx.drawImage(image, sx, sy, sw, sh, dx * 8, dy * 8, dw * 8, dh * 8);
    }
    for (const [canvas, isBack] of [[front, false], [back, true]]) {
      const ctx = canvas.getContext("2d");
      clearCanvas(canvas);
      ctx.imageSmoothingEnabled = false;
      if (!isBack) {
        part(ctx, 8, 8, 8, 8, 6, 0, 8, 8);
        part(ctx, 20, 20, 8, 12, 6, 8, 8, 12);
        part(ctx, 44, 20, 4, 12, 2, 8, 4, 12);
        part(ctx, 36, 52, 4, 12, 14, 8, 4, 12);
        part(ctx, 4, 20, 4, 12, 6, 20, 4, 12);
        part(ctx, 20, 52, 4, 12, 10, 20, 4, 12);
      } else {
        part(ctx, 24, 8, 8, 8, 6, 0, 8, 8);
        part(ctx, 32, 20, 8, 12, 6, 8, 8, 12);
        part(ctx, 52, 20, 4, 12, 2, 8, 4, 12);
        part(ctx, 44, 52, 4, 12, 14, 8, 4, 12);
        part(ctx, 12, 20, 4, 12, 6, 20, 4, 12);
        part(ctx, 28, 52, 4, 12, 10, 20, 4, 12);
      }
    }
  }
  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.type !== "image/png" || file.size > 1024 * 1024) {
      message("Choisis un fichier PNG de 1 Mo maximum.", "error");
      input.value = "";
      return;
    }
    try {
      const image = await loadImage(URL.createObjectURL(file));
      if (image.naturalWidth !== 64 || image.naturalHeight !== 64) {
        message("Le skin doit mesurer exactement 64 × 64 pixels.", "error");
        input.value = "";
        return;
      }
      drawSkin(image);
      message("Aperçu chargé. Clique sur « Enregistrer mon skin » pour le sauvegarder.");
    } catch {
      message("Impossible de lire cette image PNG.", "error");
    }
  });

  button.addEventListener("click", async () => {
    const file = input.files && input.files[0];
    if (!file) { message("Choisis d'abord un fichier PNG.", "error"); return; }
    button.disabled = true;
    message("Envoi du skin en cours…");
    try {
      const form = new FormData();
      form.append("skin", file, "skin.png");
      const response = await fetch(SKIN_API + "/skin-upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: form
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem("wc_account_token");
        location.href = "connexion.html";
        return;
      }
      if (!response.ok || !result.ok) throw new Error(result.error || "L'enregistrement a échoué.");
      message(result.message || "Skin enregistré !", "ok");
      input.value = "";
    } catch (error) {
      message(error.message || "Une erreur est survenue.", "error");
    } finally {
      button.disabled = false;
    }
  });

  try {
    const response = await fetch(SKIN_API + "/skin-status", {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store"
    });
    const result = await response.json();
    if (response.status === 401) {
      localStorage.removeItem("wc_account_token");
      location.href = "connexion.html";
      return;
    }
    if (result.ok && result.skinUrl) {
      const image = await loadImage(result.skinUrl + "?v=" + Date.now());
      drawSkin(image);
      message("Ton skin actuel est chargé. Tu peux en importer un nouveau pour le remplacer.");
    }
  } catch {
    // L'absence de skin enregistré est normale pour un nouveau compte.
  }
});
