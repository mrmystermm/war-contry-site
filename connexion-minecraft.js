// La page sera reliée aux routes sécurisées du Worker lors de la mise en place de la liaison.
document.addEventListener("DOMContentLoaded",()=>{
 const token=localStorage.getItem("wc_account_token");
 const notice=document.getElementById("minecraft-link-notice");
 const button=document.getElementById("minecraft-link-submit");
 const input=document.getElementById("minecraft-link-code");
 if(!token){location.href="connexion.html";return;}
 button.addEventListener("click",()=>{
   const code=input.value.trim();
   if(!/^\d{8}$/.test(code)){notice.textContent="Saisis le code à 8 chiffres affiché en jeu.";notice.className="notice error";return;}
   notice.textContent="La vérification du code sera activée avec le service de liaison Minecraft.";
   notice.className="notice";
 });
});