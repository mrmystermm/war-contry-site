const ALLOWED_ORIGINS = new Set(["https://play-warcontry.com","https://www.play-warcontry.com"]);
const API = "https://serveur-prive.net/api/v1/servers";
const VOTE_URL = "https://serveur-prive.net/minecraft/war-contry/vote";

function json(data,status=200,origin=""){
  const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
  if(ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"]=origin;
  return new Response(status===204?null:JSON.stringify(data),{status,headers});
}

export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get("Origin")||"";
  if(request.method==="OPTIONS") return json({ok:true},204,origin);
  if(!ALLOWED_ORIGINS.has(origin)) return json({ok:false,error:"Origine non autorisée."},403,origin);
  if(!env.DB||!env.SERVEUR_PRIVE_TOKEN) return json({ok:false,error:"Configuration Worker incomplète."},500,origin);
  try{
   if(url.pathname==="/start"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    const pseudo=String(body.pseudo||"").trim();
    if(!/^[A-Za-z0-9_]{3,16}$/.test(pseudo)) return json({ok:false,error:"Entre un pseudo Minecraft valide (3 à 16 caractères)."},400,origin);
    const apiUrl=`${API}/${encodeURIComponent(env.SERVEUR_PRIVE_TOKEN)}/otp`;
    const apiResponse=await fetch(apiUrl,{headers:{Accept:"application/json"}});
    const apiData=await apiResponse.json().catch(()=>null);
    if(!apiResponse.ok||!apiData?.success||!apiData?.data?.token) return json({ok:false,error:"Impossible de générer le code OTP. Vérifie le token et la configuration OTP."},502,origin);
    const id=crypto.randomUUID(),createdAt=Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO sp_vote_sessions (id,pseudo,otp_token,status,created_at) VALUES (?,?,?,'pending',?)")
      .bind(id,pseudo,apiData.data.token,createdAt).run();
    const voteUrl=`${VOTE_URL}/${encodeURIComponent(pseudo)}?token=${encodeURIComponent(apiData.data.token)}`;
    return json({ok:true,session:id,vote_url:voteUrl},200,origin);
   }
   if(url.pathname==="/status"&&request.method==="GET"){
    const id=url.searchParams.get("id")||"";
    if(!/^[0-9a-f-]{36}$/i.test(id)) return json({ok:false,error:"Session invalide."},400,origin);
    const s=await env.DB.prepare("SELECT id,pseudo,otp_token,status,created_at,voted_at,next_vote_seconds FROM sp_vote_sessions WHERE id=?").bind(id).first();
    if(!s) return json({ok:false,error:"Session introuvable."},404,origin);
    if(s.status==="confirmed") return json({ok:true,status:"confirmed",pseudo:s.pseudo,next_vote_seconds:s.next_vote_seconds},200,origin);
    const now=Math.floor(Date.now()/1000);
    if(now>s.created_at+300){
     await env.DB.prepare("UPDATE sp_vote_sessions SET status='expired' WHERE id=?").bind(id).run();
     return json({ok:true,status:"expired"},200,origin);
    }
    const checkUrl=`${API}/${encodeURIComponent(env.SERVEUR_PRIVE_TOKEN)}/votes/otp/${encodeURIComponent(s.otp_token)}`;
    const checkResponse=await fetch(checkUrl,{headers:{Accept:"application/json"}});
    const checkData=await checkResponse.json().catch(()=>null);
    const vote=checkData?.data;
    if(checkResponse.ok&&checkData?.success&&vote?.voted_at){
     const returnedPseudo=String(vote.username||"").trim();
     if(returnedPseudo.toLowerCase()!==s.pseudo.toLowerCase()){
      return json({ok:true,status:"username_mismatch",message:"Le pseudo confirmé par Serveur Privé ne correspond pas au pseudo saisi."},200,origin);
     }
     const votedAt=Number(vote.voted_at),nextSeconds=Math.max(0,Number(vote.next_vote_seconds)||0);
     await env.DB.batch([
      env.DB.prepare("UPDATE sp_vote_sessions SET status='confirmed',voted_at=?,next_vote_seconds=? WHERE id=?").bind(votedAt,nextSeconds,id),
      env.DB.prepare("INSERT OR IGNORE INTO sp_votes (pseudo,voted_at,next_vote_seconds,source) VALUES (?,?,?,'serveur-prive')").bind(s.pseudo,votedAt,nextSeconds)
     ]);
     return json({ok:true,status:"confirmed",pseudo:s.pseudo,next_vote_seconds:nextSeconds},200,origin);
    }
    return json({ok:true,status:"pending",seconds_left:Math.max(0,s.created_at+300-now)},200,origin);
   }
   return json({ok:false,error:"Route inconnue."},404,origin);
  }catch(error){
   console.error("War Contry votes Worker error:",error);
   return json({ok:false,error:"Erreur serveur. Réessaie plus tard."},500,origin);
  }
 }
};
