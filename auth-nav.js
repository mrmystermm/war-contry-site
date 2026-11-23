const WC_AUTH_API="https://warcontry-accounts.mr-mystermm.workers.dev";
document.addEventListener("DOMContentLoaded",async()=>{
 const link=document.querySelector('.links a[href="connexion.html"]');
 if(!link)return;
 const token=localStorage.getItem("wc_account_token");
 if(!token)return;
 try{
  const response=await fetch(WC_AUTH_API+"/me",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error("Session expirée");
  link.textContent="👤 Mon compte";
  link.href="mon-compte.html";
 }catch(error){localStorage.removeItem("wc_account_token");}
});