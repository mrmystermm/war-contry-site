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
    "La nouvelle adresse devra être confirmée par e-mail avant tout changement.":"The new address must be confirmed by email before any change is made.",
    "Événement de Noël":"Christmas event",
    "🎁 Calendrier de l'Avent":"🎁 Advent calendar",
    "🗳️ Votes":"🗳️ Votes",
    "👤 Connexion":"👤 Log in",
    "❄ Grand événement de Noël 2026":"❄ Christmas 2026 special event",
    "Noël s'invite sur":"Christmas is coming to",
    "Plusieurs semaines de festivités, de concours, de cadeaux et de récompenses. Début de l'événement le samedi 28 novembre 2026.":"Several weeks of festivities, contests, gifts and rewards. The event starts on Saturday, November 28, 2026.",
    "Ouvrir le calendrier":"Open the calendar",
    "Voir le programme":"View the programme",
    "L'événement commence dans":"The event starts in",
    "jours":"days",
    "heures":"hours",
    "min":"min",
    "sec":"sec",
    "Au programme":"What's on",
    "Tout ce qui vous attend sur le serveur pendant les fêtes.":"Everything waiting for you on the server during the holidays.",
    "Deux concours de décoration":"Two decoration contests",
    "Comme pour Halloween, deux concours mettront votre créativité à l'épreuve. Décorez vos territoires et tentez de remporter les meilleures récompenses.":"Just like Halloween, two contests will put your creativity to the test. Decorate your territories and try to win great rewards.",
    "Calendrier de l'Avent":"Advent calendar",
    "Chaque jour, ouvrez une nouvelle case pour découvrir votre cadeau. Une case oubliée ne pourra pas être récupérée.":"Open a new tile every day to discover your gift. Missed tiles cannot be claimed later.",
    "Accéder au calendrier →":"Go to the calendar →",
    "Événements et mini-jeux":"Events and mini-games",
    "Défis, chasses aux cadeaux, jeux et bien d'autres surprises tout au long de l'événement.":"Challenges, gift hunts, games and many other surprises throughout the event.",
    "Des récompenses à gagner":"Rewards to win",
    "Argent, objets rares, équipements issus du modpack et cadeaux exclusifs seront au rendez-vous.":"Money, rare items, modpack equipment and exclusive gifts will be up for grabs.",
    "Une ambiance de Noël":"A Christmas atmosphere",
    "Le serveur se met aux couleurs de Noël : décorations, surprises et atmosphère hivernale.":"The server gets a Christmas makeover: decorations, surprises and a winter atmosphere.",
    "Les dates à retenir":"Important dates",
    "D'autres précisions arriveront dans les prochaines annonces.":"More details will be shared in upcoming announcements.",
    "Samedi 28 novembre 2026":"Saturday, November 28, 2026",
    "Lancement de l'événement de Noël.":"Christmas event launch.",
    "Du 1er au 24 décembre":"December 1–24",
    "Une case du calendrier de l'Avent à ouvrir chaque jour.":"One Advent calendar tile to open each day.",
    "À venir":"Coming soon",
    "Dates précises, règles des concours et détails des activités.":"Exact dates, contest rules and activity details.",
    "War Contry en hiver : le château, le sapin et les cadeaux":"War Contry in winter: the castle, tree and gifts",
    "📢 Restez à l'affût !":"📢 Stay tuned!",
    "Les règles des concours et les détails des activités seront communiqués dans les prochaines annonces. Rassemblez vos amis, préparez vos constructions et soyez prêts !":"Contest rules and activity details will be shared in upcoming announcements. Gather your friends, prepare your builds and get ready!",
    "Voir le calendrier de l'Avent":"View the Advent calendar",
    "Événement de Noël 2026 · Cette année, Noël s'annonce exceptionnel.":"Christmas event 2026 · This year, Christmas will be extraordinary.",
    "❄ Noël 2026":"❄ Christmas 2026",
    "Une case par jour. Des surprises t'attendent…":"One tile each day. Surprises are waiting for you…",
    "Une case passée ne peut pas être ouverte plus tard. Les cases futures restent verrouillées.":"A missed tile cannot be opened later. Future tiles remain locked.",
    "Ouvrir la case 🎁":"Open the tile 🎁",
    "Ton pseudo Minecraft":"Your Minecraft username",
    "Valider":"Confirm",
    "Annuler":"Cancel",
    "Case validée !":"Tile claimed!",
    "Ouverte":"Opened",
    "Manquée":"Missed",
    "Pas encore":"Not yet",
    "Ouvrir aujourd’hui":"Open today",
    "Entre un pseudo pour continuer.":"Enter a username to continue.",
    "Le pseudo doit contenir entre 3 et 16 lettres, chiffres ou underscores.":"Your username must contain 3–16 letters, numbers or underscores.",
    "Envoi de ta demande…":"Sending your request…",
    "Impossible d’enregistrer la demande.":"Unable to save your request.",
    "Ta réclamation a bien été enregistrée. Merci !":"Your claim has been recorded. Thank you!",
    "Erreur de connexion. Réessaie dans un instant.":"Connection error. Please try again in a moment.",
    "Calendrier terminé — merci !":"Calendar finished — thank you!",
    "Ouverture le 1er décembre 2026":"Opens on December 1, 2026",
    "✦ Soutiens War Contry":"✦ Support War Contry",
    "Votes & récompenses":"Votes & rewards",
    "Vote sur les plateformes partenaires pour soutenir le serveur.":"Vote on partner platforms to support the server.",
    "Choisis une plateforme, entre ton pseudo Minecraft et vote pour soutenir le serveur.":"Choose a platform, enter your Minecraft username and vote to support the server.",
    "Soutiens War Contry sur Planet Minecraft.":"Support War Contry on Planet Minecraft.",
    "Ajoute ton vote sur la liste Serveur Minecraft.":"Add your vote to the Serveur Minecraft list.",
    "Retrouve War Contry dans la liste Minecraft IP List.":"Find War Contry on the Minecraft IP List.",
    "Entre ton pseudo Minecraft, puis utilise le bouton pour générer un lien de vote sécurisé.":"Enter your Minecraft username, then use the button to generate a secure voting link.",
    "Préparer mon vote":"Prepare my vote",
    "En attente de ton pseudo.":"Waiting for your username.",
    "🔥 Ta série de votes":"🔥 Your voting streak",
    "La série sera calculée à partir des votes confirmés, sans confondre les délais propres à chaque plateforme.":"Your streak will be calculated from confirmed votes, taking each platform's specific timing into account.",
    "🎁 Tes récompenses":"🎁 Your rewards",
    "Les récompenses seront définies séparément. Aucun clic sur un lien ne sera considéré comme un vote confirmé.":"Rewards will be defined separately. Clicking a link will not count as a confirmed vote.",
    "🏆 Classement mensuel":"🏆 Monthly leaderboard",
    "Le classement sera alimenté uniquement par les votes confirmés par les plateformes partenaires.":"The leaderboard will only include votes confirmed by partner platforms.",
    "À savoir :":"Please note:",
    "Votes communautaires · Merci de soutenir le serveur !":"Community votes · Thank you for supporting the server!",
    "Ouvrir et participer ↗":"Open and participate ↗",
    "Pseudo Minecraft":"Minecraft username",
    "Participation acceptée ! Merci d’avoir voté pour War Contry !":"Participation accepted! Thank you for voting for War Contry!",
    "En attente de ton vote…":"Waiting for your vote…",
    "En attente…":"Waiting…",
    "Participer à nouveau":"Participate again",
    "Entre un pseudo Minecraft valide (3 à 16 caractères).":"Enter a valid Minecraft username (3–16 characters).",
    "Le navigateur a bloqué l’ouverture. Autorise les fenêtres pop-up puis réessaie.":"Your browser blocked the pop-up. Allow pop-ups and try again.",
    "✓ Ta réclamation a bien été enregistrée. Merci !":"✓ Your claim has been recorded. Thank you!",
    "Merci d’avoir soutenu War Contry !":"Thank you for supporting War Contry!",
    "Le pseudo confirmé par Serveur Privé ne correspond pas. Aucun vote n’a été attribué.":"The username confirmed by Serveur Privé does not match. No vote was awarded.",
    "Le code de vote a expiré. Prépare un nouveau vote.":"The voting code has expired. Prepare a new vote.",
    "Préparation de la vérification du vote…":"Preparing vote verification…",
    "Vérification impossible.":"Verification failed.",
    "Impossible de préparer le vote.":"Unable to prepare the vote."
  };
  function translate(language) {
    const dictionary = language === "en" ? EN : Object.fromEntries(Object.entries(EN).map(([fr,en]) => [en,fr]));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const original = node.nodeValue;
      const trimmed = original.trim();
      if (!trimmed || !dictionary[trimmed]) continue;
      node.nodeValue = original.replace(trimmed, dictionary[trimmed]);
    }
    document.querySelectorAll("select option").forEach(option => {
      const label = option.textContent.trim();
      if (dictionary[label]) option.textContent = dictionary[label];
    });
    const titles = {
      "War Contry — Événement de Noël 2026":"War Contry — Christmas Event 2026",
      "War Contry — Calendrier de l'Avent 2026":"War Contry — Advent Calendar 2026",
      "War Contry — Votes":"War Contry — Votes",
      "Mon compte — War Contry":"My account — War Contry",
      "Langue — War Contry":"Language — War Contry",
      "Apparence — War Contry":"Appearance — War Contry",
      "Sécurité — War Contry":"Security — War Contry",
      "Zone sensible — War Contry":"Danger zone — War Contry",
      "Modifier mon pseudo — War Contry":"Change my username — War Contry",
      "Modifier mon adresse e-mail — War Contry":"Change my email address — War Contry"
    };
    const titleMap = language === "en" ? titles : Object.fromEntries(Object.entries(titles).map(([fr,en]) => [en,fr]));
    if (titleMap[document.title]) document.title = titleMap[document.title];
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      const descriptions = {
        "Concours de décoration, calendrier de l'Avent, mini-jeux et récompenses : le grand événement de Noël de War Contry démarre le 28 novembre 2026.":"Decoration contests, an Advent calendar, mini-games and rewards: War Contry's big Christmas event starts on November 28, 2026.",
        "Ouvre une case par jour du 1er au 24 décembre 2026 sur War Contry.":"Open one tile per day from December 1 to 24, 2026 on War Contry.",
        "Vote pour War Contry et soutiens le serveur.":"Vote for War Contry and support the server."
      };
      const descriptionMap = language === "en" ? descriptions : Object.fromEntries(Object.entries(descriptions).map(([fr,en]) => [en,fr]));
      if (descriptionMap[description.content]) description.content = descriptionMap[description.content];
    }
  }
  window.wcApplyLanguage = translate;
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
      if (data.preferences.language === "en") {
        const observer = new MutationObserver(() => translate(document.documentElement.lang));
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      }
      window.dispatchEvent(new CustomEvent("wc-preferences-loaded", { detail: data.preferences }));
    }).catch(() => {});
})();
