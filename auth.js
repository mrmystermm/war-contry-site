const API="https://warcontry-accounts.mr-mystermm.workers.dev";
const $=id=>document.getElementById(id);
function show(message,type=""){const e=$("notice");if(e){e.textContent=message;e.className="notice "+type}}
async function call(path,data){const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw Error(d.error||"Une erreur est survenue.");return d}
const token=()=>new URLSearchParams(location.search).get("token")||"";
let registrationCheckRunning=false;
async function refreshRegistrationState(){
 const form=$("register-form");
 const connected=$("register-connected");
 if(!form||!connected||registrationCheckRunning)return;
 const savedToken=localStorage.getItem("wc_account_token");
 if(!savedToken)return;
 registrationCheckRunning=true;
 try{
  const response=await fetch(API+"/me",{headers:{Authorization:"Bearer "+savedToken},cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403||!data.ok){
   localStorage.removeItem("wc_account_token");
   return;
  }
  if(!response.ok)throw new Error("Vérification de session indisponible");
  form.hidden=true;
  connected.hidden=false;
  const links=document.querySelector(".auth-links");
  if(links)links.hidden=true;
  show("Adresse e-mail vérifiée : ton compte est maintenant actif et connecté.","ok");
 }catch(error){
  // Une erreur réseau temporaire ne doit pas supprimer la session enregistrée.
 }finally{
  registrationCheckRunning=false;
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 const bind=(id,path,payload,done)=>{const f=$(id);if(!f)return;f.addEventListener("submit",async e=>{e.preventDefault();show("Traitement en cours…");try{const d=await call(path,payload());show(d.message||"Opération réussie.","ok");if(done)done(d)}catch(x){show(x.message,"error")}})};
 bind("register-form","/register",()=>({username:$("username").value,email:$("email").value,password:$("password").value}),()=> $("register-form").reset());
 bind("login-form","/login",()=>({email:$("email").value,password:$("password").value}),d=>{localStorage.setItem("wc_account_token",d.token);location.href="mon-compte.html"});
 bind("forgot-form","/forgot-password",()=>({email:$("email").value}),()=> $("forgot-form").reset());
 bind("reset-form","/reset-password",()=>({token:token(),password:$("password").value}),()=> $("reset-form").reset());
 const v=$("verify-action");
 if(v)v.addEventListener("click",async()=>{
  v.disabled=true;
  show("Vérification en cours…");
  try{
   const d=await call("/verify",{token:token()});
   localStorage.setItem("wc_account_token",d.token);
   v.hidden=true;
   const description=$("verify-description");
   if(description)description.textContent="Ton adresse e-mail a bien été vérifiée. Ton compte est maintenant actif et tu es connecté.";
   show("Compte vérifié avec succès ! Tu peux fermer cette page et retourner à l'onglet où tu as fait ton inscription.","ok");
  }catch(e){
   v.disabled=false;
   show(e.message,"error");
  }
 });
 refreshRegistrationState();
 window.addEventListener("storage",event=>{
  if(event.key==="wc_account_token")refreshRegistrationState();
 });
 // Quand l'utilisateur revient sur l'onglet d'inscription après avoir fermé
 // l'onglet de vérification, on contrôle immédiatement sa session.
 window.addEventListener("focus",refreshRegistrationState);
 window.addEventListener("pageshow",refreshRegistrationState);
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)refreshRegistrationState();
 });
 const info=$("account-details");if(info){const t=localStorage.getItem("wc_account_token");if(!t){location.href="connexion.html";return}fetch(API+"/me",{headers:{Authorization:"Bearer "+t}}).then(r=>r.json()).then(d=>{if(!d.ok)throw Error();$("account-name").textContent=d.account.username;$("account-email").textContent=d.account.email}).catch(()=>{localStorage.removeItem("wc_account_token");location.href="connexion.html"})}
 const out=$("logout");if(out)out.addEventListener("click",async()=>{const t=localStorage.getItem("wc_account_token");try{await fetch(API+"/logout",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:"{}"})}finally{localStorage.removeItem("wc_account_token");location.href="connexion.html"}});
});