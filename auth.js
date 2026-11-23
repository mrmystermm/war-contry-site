const API="https://warcontry-accounts.mr-mystermm.workers.dev";
const $=id=>document.getElementById(id);
function show(message,type=""){const e=$("notice");if(e){e.textContent=message;e.className="notice "+type}}
async function call(path,data){const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw Error(d.error||"Une erreur est survenue.");return d}
const token=()=>new URLSearchParams(location.search).get("token")||"";
document.addEventListener("DOMContentLoaded",()=>{
 const bind=(id,path,payload,done)=>{const f=$(id);if(!f)return;f.addEventListener("submit",async e=>{e.preventDefault();show("Traitement en cours…");try{const d=await call(path,payload());show(d.message||"Opération réussie.","ok");if(done)done(d)}catch(x){show(x.message,"error")}})};
 bind("register-form","/register",()=>({username:$("username").value,email:$("email").value,password:$("password").value}),()=> $("register-form").reset());
 bind("login-form","/login",()=>({email:$("email").value,password:$("password").value}),d=>{sessionStorage.setItem("wc_account_token",d.token);location.href="mon-compte.html"});
 bind("forgot-form","/forgot-password",()=>({email:$("email").value}),()=> $("forgot-form").reset());
 bind("reset-form","/reset-password",()=>({token:token(),password:$("password").value}),()=> $("reset-form").reset());
 const v=$("verify-action");if(v)v.addEventListener("click",async()=>{try{const d=await call("/verify",{token:token()});show(d.message,"ok")}catch(e){show(e.message,"error")}});
 const info=$("account-details");if(info){const t=sessionStorage.getItem("wc_account_token");if(!t){location.href="connexion.html";return}fetch(API+"/me",{headers:{Authorization:"Bearer "+t}}).then(r=>r.json()).then(d=>{if(!d.ok)throw Error();$("account-name").textContent=d.account.username;$("account-email").textContent=d.account.email}).catch(()=>{sessionStorage.removeItem("wc_account_token");location.href="connexion.html"})}
 const out=$("logout");if(out)out.addEventListener("click",async()=>{const t=sessionStorage.getItem("wc_account_token");try{await fetch(API+"/logout",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:"{}"})}finally{sessionStorage.removeItem("wc_account_token");location.href="connexion.html"}});
});