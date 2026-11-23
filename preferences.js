(() => {
  const API = "https://warcontry-accounts.mr-mystermm.workers.dev";
  const EN = {
    "← Retour au site":"← Back to website",
    "← Mon compte":"← My account",
    "👤 Compte":"👤 Account",
    "🌐 Langue":"🌐 Language",
    "🎨 Apparence":"🎨 Appearance",
    "🔒 Sécurité":"🔒 Security",
    "⚠️ Zone sensible":"⚠️ Danger zone",
    "Paramètres du compte":"Account settings",
    "Espace personnel":"Personal area",
    "Mon compte":"My account",
    "Gère les informations principales de ton compte War Contry.":"Manage the main information of your War Contry account.",
    "Pseudo":"Username",
    "Chargement…":"Loading…",
    "Modifier →":"Edit →",
    "Adresse e-mail":"Email address",
    "Mot de passe":"Password",
    "Protège l'accès à ton compte.":"Protects access to your account.",
    "Gérer →":"Manage →",
    "Se déconnecter":"Log out",
    "WAR CONTRY · Espace joueur":"WAR CONTRY · Player area",
    "Préférences":"Preferences",
    "Langue":"Language",
    "Choisis ta langue préférée. Ce choix sera enregistré sur ton compte et retrouvé sur tes autres appareils. La traduction anglaise des différentes pages sera déployée progressivement.":"Choose your preferred language. This setting is saved to your account and available on your other devices.",
    "Langue préférée":"Preferred language",
    "Français":"French",
    "Enregistrer la langue":"Save language",
    "Personnalisation":"Personalization",
    "Apparence":"Appearance",
    "Choisis le thème de ton espace War Contry. Ton choix sera synchronisé avec ton compte.":"Choose the theme for your War Contry account area. Your choice will be synced with your account.",
    "Thème":"Theme",
    "Sombre":"Dark",
    "Clair":"Light",
    "Enregistrer l'apparence":"Save appearance",
    "Protection":"Protection",
    "Sécurité":"Security",
    "Réinitialise ton mot de passe avec ton adresse e-mail.":"Reset your password using your email address.",
    "Changer →":"Change →",
    "Authentification à deux facteurs (A2F)":"Two-factor authentication (2FA)",
    "Cette fonctionnalité n'est pas encore activée.":"This feature is not available yet.",
    "Bientôt disponible":"Coming soon",
    "Actions irréversibles":"Irreversible actions",
    "Zone sensible":"Danger zone",
    "Supprimer mon compte":"Delete my account",
    "La suppression définitive du compte sera irréversible. La procédure sécurisée de confirmation n'est pas encore disponible ; aucun compte ne peut être supprimé depuis cette page pour le moment.":"Deleting your account will be permanent. The secure confirmation process is not available yet, so accounts cannot currently be deleted from this page.",
    "Modifier mon pseudo":"Change my username",
    "La modification du pseudo devra être vérifiée pour éviter les doublons et protéger ton compte.":"Username changes will need to be verified to prevent duplicates and protect your account.",
    "Cette modification sera activée dans une prochaine étape. Aucune donnée de ton compte ne sera modifiée depuis cette page pour le moment.":"This feature will be enabled in a later step. No account information can be changed from this page yet.",
    "Retour à mon compte":"Back to my account",
    "Modifier mon adresse e-mail":"Change my email address",
    "La nouvelle adresse devra être confirmée par e-mail avant tout changement.":"The new address must be confirmed by email before any change is made."
  };
  function translate(language) {
    if (language !== "en") return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const original = node.nodeValue;
      const trimmed = original.trim();
      if (!trimmed || !EN[trimmed]) continue;
      node.nodeValue = original.replace(trimmed, EN[trimmed]);
    }
    document.querySelectorAll("select option").forEach(option => {
      if (EN[option.textContent.trim()]) option.textContent = EN[option.textContent.trim()];
    });
    const titles = {
      "Mon compte — War Contry":"My account — War Contry",
      "Langue — War Contry":"Language — War Contry",
      "Apparence — War Contry":"Appearance — War Contry",
      "Sécurité — War Contry":"Security — War Contry",
      "Zone sensible — War Contry":"Danger zone — War Contry",
      "Modifier mon pseudo — War Contry":"Change my username — War Contry",
      "Modifier mon adresse e-mail — War Contry":"Change my email address — War Contry"
    };
    if (titles[document.title]) document.title = titles[document.title];
  }
  const token = localStorage.getItem("wc_account_token");
  if (!token) return;
  fetch(API + "/preferences", { headers: { Authorization: "Bearer " + token }, cache: "no-store" })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ok,data}) => {
      if (!ok || !data.ok || !data.preferences) return;
      document.documentElement.dataset.theme = data.preferences.theme;
      document.documentElement.lang = data.preferences.language;
      window.wcPreferences = data.preferences;
      translate(data.preferences.language);
      window.dispatchEvent(new CustomEvent("wc-preferences-loaded", { detail: data.preferences }));
    }).catch(() => {});
})();
